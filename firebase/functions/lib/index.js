"use strict";
/**
 * OneJellyInvest Firebase Functions
 *
 * OpenDART API에서 공시를 수집하여 Cloudflare D1에 저장
 * (Cloudflare Workers에서 직접 호출 시 IP 차단 문제 우회)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDisclosuresManual = exports.collectDisclosures = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
// Secrets (Firebase Console에서 설정)
const OPENDART_API_KEY = (0, params_1.defineSecret)("OPENDART_API_KEY");
const CLOUDFLARE_API_URL = (0, params_1.defineSecret)("CLOUDFLARE_API_URL");
const CLOUDFLARE_API_SECRET = (0, params_1.defineSecret)("CLOUDFLARE_API_SECRET");
// ============================================
// 카테고리 분류 룰
// ============================================
const CATEGORY_RULES = {
    "실적": [
        "사업보고서", "분기보고서", "반기보고서", "잠정실적",
        "매출액", "영업이익", "실적", "연결재무", "재무제표",
    ],
    "수주계약": [
        "수주", "계약", "공급계약", "납품", "공급", "용역계약", "라이선스",
    ],
    "자본": [
        "유상증자", "무상증자", "증자", "감자", "전환사채",
        "CB", "BW", "신주인수권", "주식매수선택권", "신주",
    ],
    "주주가치": [
        "배당", "현금배당", "자사주", "자기주식", "주식소각", "주주환원",
    ],
    "지배구조": [
        "임원", "이사회", "주총", "주주총회", "최대주주", "대표이사", "감사", "사외이사",
    ],
    "리스크": [
        "소송", "횡령", "배임", "감사의견", "비적정",
        "상장폐지", "관리종목", "회생", "파산", "부도", "거래정지",
    ],
    "기타": [],
};
// ============================================
// OpenDART API 클라이언트
// ============================================
class OpenDartClient {
    baseUrl = "https://opendart.fss.or.kr/api";
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async getDisclosureList(params) {
        const searchParams = new URLSearchParams({
            crtfc_key: this.apiKey,
            page_count: String(params.page_count || 100),
            page_no: String(params.page_no || 1),
        });
        if (params.bgn_de)
            searchParams.set("bgn_de", params.bgn_de);
        if (params.end_de)
            searchParams.set("end_de", params.end_de);
        const url = `${this.baseUrl}/list.json?${searchParams}`;
        console.log(`Fetching: ${url.replace(this.apiKey, "***")}`);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                "Accept": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`OpenDART API error: ${response.status}`);
        }
        return response.json();
    }
    async getAllRecentDisclosures(days = 1) {
        const endDate = this.formatDate(new Date());
        const startDate = this.formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
        return this.getDisclosuresForRange(startDate, endDate);
    }
    async getDisclosuresForRange(startDate, endDate) {
        const allItems = [];
        let pageNo = 1;
        const maxPages = 10;
        while (pageNo <= maxPages) {
            const response = await this.getDisclosureList({
                bgn_de: startDate,
                end_de: endDate,
                page_no: pageNo,
                page_count: 100,
            });
            if (response.status !== "000") {
                if (response.status === "013")
                    break; // 조회 결과 없음
                throw new Error(`OpenDART error: ${response.message}`);
            }
            allItems.push(...response.list);
            console.log(`Page ${pageNo}/${response.total_page}: ${response.list.length} items`);
            if (pageNo >= response.total_page)
                break;
            pageNo++;
        }
        return allItems;
    }
    formatDate(date) {
        return date.toISOString().slice(0, 10).replace(/-/g, "");
    }
}
// ============================================
// 공시 분류 및 변환
// ============================================
function classifyCategory(title) {
    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
        if (category === "기타")
            continue;
        if (keywords.some((kw) => title.includes(kw))) {
            return category;
        }
    }
    return "기타";
}
function extractType(title) {
    const types = [
        "사업보고서", "반기보고서", "분기보고서", "잠정실적",
        "주요사항보고서", "공급계약", "수주공시", "배당결정",
        "증자결정", "자기주식취득",
    ];
    for (const type of types) {
        if (title.includes(type))
            return type;
    }
    const match = title.match(/\[([^\]]+)\]/);
    if (match)
        return match[1];
    return "일반공시";
}
function formatIsoDate(yyyymmdd) {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
function isKrxCorp(corpCls) {
    return corpCls === "Y" || corpCls === "K" || corpCls === "N";
}
function convertToDisclosure(item) {
    const category = classifyCategory(item.report_nm);
    const type = extractType(item.report_nm);
    const isCorrection = item.rm?.includes("정정") || item.report_nm.includes("[정정]");
    return {
        rcept_no: item.rcept_no,
        corp_code: item.corp_code,
        stock_code: item.stock_code || null,
        corp_name: item.corp_name,
        disclosed_at: formatIsoDate(item.rcept_dt),
        category,
        type,
        title: item.report_nm,
        key_json: null,
        source_url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
        is_correction: isCorrection,
    };
}
// ============================================
// Cloudflare D1 저장 (Worker API 호출)
// ============================================
async function saveToCloudflare(disclosures, apiUrl, apiSecret) {
    const result = { saved: 0, errors: [] };
    // 배치로 전송 (50개씩)
    const batchSize = 50;
    for (let i = 0; i < disclosures.length; i += batchSize) {
        const batch = disclosures.slice(i, i + batchSize);
        try {
            const response = await fetch(`${apiUrl}/api/internal/disclosures/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-Secret": apiSecret,
                },
                body: JSON.stringify({ disclosures: batch }),
            });
            if (!response.ok) {
                const text = await response.text();
                result.errors.push(`Batch ${i / batchSize + 1}: ${response.status} - ${text}`);
                continue;
            }
            const data = await response.json();
            result.saved += data.inserted || batch.length;
        }
        catch (err) {
            result.errors.push(`Batch ${i / batchSize + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return result;
}
// ============================================
// 스케줄러: 5분마다 공시 수집
// ============================================
exports.collectDisclosures = (0, scheduler_1.onSchedule)({
    schedule: "every 5 minutes",
    timeZone: "Asia/Seoul",
    secrets: [OPENDART_API_KEY, CLOUDFLARE_API_URL, CLOUDFLARE_API_SECRET],
    memory: "256MiB",
    timeoutSeconds: 120,
}, async () => {
    console.log("Starting disclosure collection...");
    const apiKey = OPENDART_API_KEY.value();
    const cfApiUrl = CLOUDFLARE_API_URL.value();
    const cfApiSecret = CLOUDFLARE_API_SECRET.value();
    if (!apiKey || !cfApiUrl || !cfApiSecret) {
        console.error("Missing required secrets");
        return;
    }
    try {
        const client = new OpenDartClient(apiKey);
        const items = await client.getAllRecentDisclosures(1);
        console.log(`Fetched ${items.length} items from OpenDART`);
        // KRX 상장사만 필터링
        const krxItems = items.filter((item) => isKrxCorp(item.corp_cls));
        console.log(`Filtered to ${krxItems.length} KRX items`);
        // 변환
        const disclosures = krxItems.map(convertToDisclosure);
        // Cloudflare에 저장
        const saveResult = await saveToCloudflare(disclosures, cfApiUrl, cfApiSecret);
        console.log(`Saved ${saveResult.saved} disclosures, ${saveResult.errors.length} errors`);
        if (saveResult.errors.length > 0) {
            console.error("Errors:", saveResult.errors);
        }
    }
    catch (err) {
        console.error("Collection failed:", err);
    }
});
// ============================================
// HTTP 트리거: 수동 실행용
// ============================================
exports.collectDisclosuresManual = (0, https_1.onRequest)({
    secrets: [OPENDART_API_KEY, CLOUDFLARE_API_URL, CLOUDFLARE_API_SECRET],
    memory: "256MiB",
    timeoutSeconds: 120,
}, async (req, res) => {
    // 간단한 인증
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    console.log("Manual disclosure collection triggered");
    const apiKey = OPENDART_API_KEY.value();
    const cfApiUrl = CLOUDFLARE_API_URL.value();
    const cfApiSecret = CLOUDFLARE_API_SECRET.value();
    if (!apiKey || !cfApiUrl || !cfApiSecret) {
        res.status(500).json({ error: "Missing configuration" });
        return;
    }
    try {
        const days = parseInt(req.query.days) || 1;
        const client = new OpenDartClient(apiKey);
        const items = await client.getAllRecentDisclosures(days);
        const krxItems = items.filter((item) => isKrxCorp(item.corp_cls));
        const disclosures = krxItems.map(convertToDisclosure);
        const saveResult = await saveToCloudflare(disclosures, cfApiUrl, cfApiSecret);
        res.json({
            success: true,
            fetched: items.length,
            krxFiltered: krxItems.length,
            saved: saveResult.saved,
            errors: saveResult.errors,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error("Manual collection failed:", err);
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
});
//# sourceMappingURL=index.js.map