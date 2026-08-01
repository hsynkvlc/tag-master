# Tag Master — Çoklu Vendor + sGTM Genişleme Yol Haritası

*Tarih: 2026-08-01 · Durum: PLANLANDI · Mevcut sürüm: 1.2.1*

## Özet

Tag Master bugün fiilen yalnızca Google ürünlerini (GTM, GA4, Google Ads, Floodlight) yakalıyor.
Hedef: Meta, Adform, RTB House, Criteo, TikTok, LinkedIn, Bing UET vb. + **server-side GTM (sGTM)
tespiti** + **Consent Mode v2 çapraz doğrulama** ile pazardaki boş pozisyonu almak.

### Pazar boşluğu (rakip araştırması sonucu)

| Rakip | Kullanıcı | Durum | Boşluk |
|---|---|---|---|
| Google Tag Assistant | ~3M | aktif | sadece Google |
| Meta Pixel Helper | ~2-3M | aktif | sadece Meta |
| Omnibug | 200K | son güncelleme Oca 2025 | 127 provider ama sGTM'i kaçırıyor (host-bazlı eşleşme), eski devtools UX |
| Analytics Debugger | 100K | **Eyl 2023'ten beri bayat** | — |
| WASP / Trackie | 30K / 171 | ölü | — |
| GTM Server-side Tagging Detector | 442 | niş | sadece host+FPID kontrolü |

**Kimsenin yapmadığı üçlü:** çoklu-vendor decode + sGTM-farkındalıklı (first-party proxy'de bile
çalışan path-öncelikli) tespit + Consent Mode v2 per-hit ihlal uyarısı. Bu bizim konumumuz.

---

## Kritik keşif: ölü kod kapısı

`service-worker.js:596-604` → `isGoogleRequest()` (`shared/utils.js:441`) 8 Google domainlik bir
allowlist. `identifyGoogleRequest()` içinde **Meta/TikTok/LinkedIn/GA4_SERVER_SIDE dalları zaten
yazılı** (`shared/utils.js:93-117`) ama bu kapı yüzünden hiçbir zaman çalışmadı. Sidepanel'deki
"Server-Side" rozeti ve audit'teki TikTok/LinkedIn satırları da bu yüzden hiç render olmadı.

---

## Faz 0 — Onarım + kapıyı kaldırma (önkoşul, küçük)

1. `isGoogleRequest` kapısını registry-türevli matcher ile değiştir (yakala → sınıflandır → eşleşmeyeni at).
2. Tespit edilen kablolama hataları:
   - `GET_PERFORMANCE_METRICS` SW'de case yok → audit "undefined" basıyor (`sidepanel.js:3643`)
   - `CLEAR_GOOGLE_COOKIES` / `BLOCK_GA4_HITS` content-script'te case yok → butonlar sessizce çalışmıyor (handler'lar page-script'te yetim)
   - Consent paneli ölü: yanıt şekli uyuşmazlığı + `renderConsentState()` sadece console.log (`sidepanel.js:3540-3559`)
   - GTM stat chip hep 0: `'GTM_JS'` filtreleniyor, üretilen tip `'GTM'` (`sidepanel.js:2100` vs `constants.js:68`)
   - `onCompleted` URL string eşitliğiyle eşliyor → tekrarlanan hit'lerde yanlış kayıt güncelleniyor; ayrıca status güncellemesi UI'a re-broadcast edilmiyor
3. POST body'yi oku: `details.requestBody` isteniyor ama hiç kullanılmıyor — GA4 batch POST, TikTok JSON POST bunsuz görünmez.

## Faz 1 — Vendor Registry mimarisi (Omnibug provider modeli)

Tek deklaratif kayıt: `shared/vendors/` altında her vendor bir dosya:

```js
{ id, name, category, color, icon,            // UI
  hostPatterns: [...], pathPatterns: [...],   // path-ÖNCELİKLİ (sGTM dayanıklılığı), host = güven sinyali
  accountParam,                                // ör. Meta 'id', Bing 'ti', Adform 'pm'
  params: { ... },                             // param → {name, group} sözlüğü
  parseBody?, parseCustom?,                    // TikTok JSON POST, Criteo p0..pN gibi zor vakalar
  globals: [...], scriptSrc: [...],            // sayfa-katmanı imzaları
  cookies: [...], cspHosts: [...] }
```

Bunu tüketen 5 nokta refactor edilir: `isGoogleRequest` → matcher, `GOOGLE_PATTERNS` → registry,
`getRequestTypeStyle` if/else merdiveni → lookup, `CSP_REQUIREMENTS` ve `runAudit` → registry-driven.
`TECH_SIGNATURES` (page-script içinde 1300 satır inline literal) ayrı dosyaya çıkarılır.

**Not:** `shared/*` ESM ama sidepanel/content classic script → yoğun kopya-yapıştır bunun sonucu.
Sidepanel'i `<script type="module">` yap, kopyaları sil (GCS decode'un iki farklı-semantikli kopyası var!).

## Faz 2 — Vendor'lar (imzalar araştırıldı, paste-ready)

Sıra: zaten yarı-yazılı olanlar → istenen yeniler → doldurma.

1. **Meta Pixel**: `facebook.com/tr`, `fbq`, `_fbp/_fbc`; `eid` parametresi = CAPI dedup sinyali (rozet!)
2. **TikTok**: `analytics.tiktok.com/api/v*/track|pixel` (JSON POST), `ttq`, `_ttp`
3. **LinkedIn**: `px.ads.linkedin.com/collect`, `pid`, `li_fat_id`
4. **Adform**: `track.adform.net/Serving/TrackPoint`, `pm` (tracking ID), `_adftrack` / `window.Adform`
5. **RTB House**: `creativecdn.com/tags?id=pr_{hash}_{event}` — event taksonomi `id` içinde, `_` ile ayrıştır; `rtbhEvents`
6. **Criteo**: `sslwidget.criteo.com/event`, `criteo_q`, `cto_bundle`; eventler `p0..pN` paketli
7. **Bing UET**: `bat.bing.com/action`, `ti`, `uetq`, `_uetsid/_uetvid/msclkid`
8. **Pinterest / Snap / Twitter-X / Taboola / Outbrain**: imzalar araştırma raporunda hazır
   (Twitter'da X rebrand: `analytics.(twitter|x).com|t.co\/i\/adsct`)

## Faz 3 — sGTM tespiti (skor bazlı, ikili değil)

- Path imzası + Google-dışı host: `/gtm.js?id=GTM-`, `/gtag/js?id=G-`, `/g/collect?v=2`, `/mp/collect`
  first-party hostta → "sGTM üzerinden" rozeti; sayfayla aynı eTLD+1 = güçlü sinyal
- `FPID` cookie **HttpOnly** ise → neredeyse kesin sGTM (JS HttpOnly set edemez)
- `X-Gtm-Server-Preview` header'ı → aktif preview oturumu
- gtag config'de `server_container_url` / `transport_url` → beyan edilen endpoint
- Stape custom loader (rastgele dosya adı) → response body'de `'gtm.start'` sniff
- Kullanıcı tanımlı first-party endpoint listesi (ayarlara ekle)
- Meta/TikTok hit'i `event_id`'li ama vendor script'i sayfada yok → server-side relay ipucu

## Faz 4 — Consent Mode v2 çapraz doğrulama (killer feature)

- `gcs` (`G1xy`) + `gcd` (v2 4-sinyal + default/update kaynağı) decode'u zaten kısmen var; registry'ye taşı
- **İhlal uyarısı:** `ad_storage=denied` iken Meta/TikTok/Adform hit'i atıldıysa panelde kırmızı bayrak.
  Hiçbir rakip yapmıyor.

## Faz 5 — Teknik borç / mağaza kalitesi

- `sidepanel.js` (3982 satır) ve `page-script.js` (2313 satır) modüllere bölünecek
- `TECH_SIGNATURES` içinde 23 duplicate key (son yazılan kazanıyor, zengin tanımlar siliniyor)
- XSS: `innerHTML` template'lerinde sayfa-kontrollü veri escape edilmiyor (36 nokta) → `escapeHtml` zorunlu
- İkonlar `cdn.simpleicons.org`'dan runtime fetch → yerel paketle (gizlilik + offline)
- `node_modules/` (puppeteer+sharp), `store-assets/`, `reddit-assets/`, 684KB `gandalf.png` paketten çıkar
- MV3 SW keep-alive `setInterval` anti-pattern'i + her frame'de sonsuz 5sn polling → event-driven yap
- `'googletag'+'manager.com'` string-split hilesini kaldır
- Ölü kod temizliği: `decodeGA4Request` ailesi, `GOOGLE_COOKIES`, `DATALAYER_TEMPLATES`, okunmayan settings bayrakları
- Yeni izin gerekmiyor: `<all_urls>` + webRequest zaten var → mağaza inceleme riski düşük

## Sürüm önerisi

- **v1.3.0** = Faz 0+1+2'nin ilk yarısı (Meta/TikTok/LinkedIn/Adform/RTB House) — "Now beyond Google" lansmanı
- **v1.4.0** = Faz 3 (sGTM) — asıl farklılaştırıcı, ayrı duyuru hak ediyor
- **v1.5.0** = Faz 4 (consent ihlal denetimi)
- Faz 5 borçları her sürüme küçük parçalar halinde dağıtılır
