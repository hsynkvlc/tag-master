# Tag Master — Büyüme Planı (Neden kurulmuyor + ne yapacağız)

*Tarih: 2026-08-01 · Kaynak: canlı store testleri + rakip yorum analizi (2 araştırma ajanı)*

## Teşhis: 3 gerçek sebep

1. **Mağazada bulunamıyoruz.** "gtm debugger", "ga4 debugger", "datalayer" aramalarında 1. sayfada YOKUZ;
   0 kullanıcılı ama başlığında keyword olan eklentiler VAR. CWS sıralaması ezici şekilde başlık-bazlı.
   Eski adımız "Tag Master"da tek arama kelimesi yoktu; açıklama 2 cümleydi. → **manifest'te düzeltildi.**
2. **Dış keşif katmanında yokuz.** Bu nişte kurulum, araç listelerinden (Analytics Mania, MeasureSchool),
   Measure Slack'ten ve Reddit'ten gelir. Hiçbirinde değiliz; tagmaster.dev tek sayfa, kendi adında bile
   1. sayfaya çıkmıyor (tagmaster.com bir RFID şirketi).
3. **Güven sinyali yok.** 154 kullanıcı, 17 tanıdık yorumu, Featured rozeti yok, 5 aydır güncelleme yok,
   demo video yok. Rakipler 80-200K kullanıcı + Featured.

**Fırsat:** Rakiplerin hepsi ya bayat (Analytics Debugger Eyl 2023), ya MV3'te kırık (dataLayer Inspector+
GTM injector'ını KAYBETTİ, son yorum ortalaması 2.5), ya kaynak canavarı (Meta Pixel Helper %70 CPU şikayetleri).
Biz MV3-native, 175KB, login'siz, telemetrisiz. Bunu hiçbir yerde söylemiyorduk.

## Store dashboard'a yapıştırılacaklar

**Ad (manifest'te güncellendi):** `Tag Master – GTM & GA4 Debugger, DataLayer Inspector`

**Kısa açıklama (manifest'te güncellendi):**
`Debug GTM, GA4, dataLayer, Meta & 40+ pixels in one side panel. Consent Mode V2 audit, server-side GTM, per-platform test modes. Local only.`

**Tam açıklama (dashboard → Store listing → Description alanına):**

```
Stop juggling GTM Preview, DebugView, and the console. Tag Master shows every tag, every dataLayer push, and every tracking hit in one side panel — decoded, validated, and consent-checked.

REAL-TIME NETWORK INSPECTOR — 42 PLATFORMS
See every tracking hit live with human-readable parameters: Google Analytics 4 (GA4), Google Ads + Enhanced Conversions (with SHA-256 validation), Floodlight, Meta Pixel (with CAPI dedup detection), TikTok, LinkedIn Insight, Criteo, Adform, RTB House, Microsoft/Bing UET, Pinterest, Snap, X Ads, Taboola, Outbrain, Adobe Analytics, Adobe Launch, Tealium, Segment, Amplitude, Mixpanel, Matomo, Piwik PRO, Yandex Metrica, Hotjar, Microsoft Clarity, FullStory, Heap, Plausible, Klaviyo, HubSpot, Braze, Optimizely, VWO, Awin, Reddit and Quora.

SERVER-SIDE GTM DETECTION (unique)
Hits proxied through your first-party sGTM endpoint are still recognized and labeled — /g/collect on your own domain, first-party gtm.js loaders, FPID cookies. No other debugger does this inline.

CONSENT MODE V2 AUDIT (unique)
Live consent state per signal (ad_storage, analytics_storage, ad_user_data, ad_personalization) plus a red-flag report of every vendor that kept firing while ad consent was denied — your GDPR blind-spot finder.

EVERY PLATFORM'S TEST MODE
Google has Tag Assistant and DebugView. TikTok, Snap, Microsoft UET, Tealium, Criteo, Yandex, Hotjar and Adobe Launch each have their own — switch one on and its test tool starts receiving your events. You can also suppress a chosen vendor's hits while you test, so your production reports stay clean.

CROSS-PLATFORM CONVERSION CHECK
The same purchase, side by side across every platform that reported it. Tag Master flags values that disagree, a value sent without a currency, a platform reporting one conversion twice, and platforms that were active on the page but stayed silent.

GTM INJECTOR THAT WORKS ON MANIFEST V3
Inject any GTM container into any page — persistent per-site if you want. (Yes, the feature other extensions lost in the MV3 migration.)

DATALAYER MONITOR & EVENT BUILDER
Live dataLayer stream with GA4 e-commerce schema validation, quick-push presets, and a visual element picker that generates stable CSS selectors for your GTM click triggers.

PLUS
• Tech-stack detection: e-commerce platform (Shopify, WooCommerce, ikas, Ticimax, İdeaSoft…), CMP, frameworks
• Tracking audit with one click • Cookie inspector • CSP compatibility check • HAR / JSON / CSV export
• Lightweight (~185 KB), no account, no login, no telemetry — everything stays in your browser

Looking for a Tag Assistant alternative, a dataLayer inspector, or a pixel helper that covers every platform at once? That's Tag Master.
```

**Ekran görüntüsü kontrol listesi:** 1) Gerçek bir sitede yan panel + akan hit'ler (ilk görsel bu),
2) Consent ihlal kutusu, 3) sGTM rozeti, 4) Platform debug modları, 5) Dönüşüm mutabakatı, 6) GTM injector. Hepsine altyazı/ok işareti.
30 sn'lik demo videosu ekle (Loom yeterli). **Featured badge başvurusu yap** (CWS best practices listesi).
**Yerelleştirme:** en az TR + ES + DE listing çevirisi (rakipler İngilizce-only).

## Policy denetimi (2026-08-01, v1.4.0) + izin gerekçeleri

Denetlendi: ❌ eval/new Function yok · ❌ string-split obfuskasyon KALDIRILDI (utils.js'deki ölü
isGoogleRequest + gtmDomain hilesi temizlendi — CWS obfuskasyon yasağına takılabilirdi) · ❌ uzak kod yok
(CDN'den yalnızca <img> ikonları geliyor, kod değil) · Ad 52 karakter, işlev tarifi — keyword listesi değil.
⚠️ **Bu bölümün iki maddesi 2026-08-02'de GEÇERSİZ kaldı, aşağıdaki gizlilik beyanı bölümü esas alınacak:**
(1) GTM Injector'ın harici `script.src` dalı v1.5.0'da KALDIRILDI — o dal Blue Argon (uzak kod) imzasıydı ve
Adswerve aynı özelliği aynı kurala kaybetti; artık yalnızca inline snippet enjekte ediliyor, `<script src>`
içeren yapıştırmalar reddediliyor. (2) "Veri toplamıyoruz" beyanı YANLIŞ — politika yerel işlemeyi de beyan
ettiriyor.

**Dashboard izin gerekçeleri (Privacy practices sekmesine yapıştır):**
- `storage`: Captured debugging sessions and user preferences are stored locally (IndexedDB). Nothing leaves the device.
- `scripting`: Re-inject the detection content scripts into already-open tabs when the user opens the panel.
- `sidePanel`: The extension's main UI is a side panel.
- `cookies`: The Cookies panel lists and lets the user delete tracking cookies of the inspected site.
- `webRequest`: Read-only observation of tracking requests to power the network inspector.
- `webNavigation`: Attribute captured events to page navigations and refresh panel state on navigation.
- `activeTab`: User-invoked actions (element picker, audits) on the current page.
- `declarativeNetRequest`: User-controlled debugging features, all off by default and scoped with session rules to the single tab being debugged: hit suppression (temporarily stop a chosen vendor's requests to verify de-duplication or reproduce a consent-denied state), GA4 DebugView toggle (adds _dbg=1 so the user's own events reach DebugView), and the server-side GTM preview header (attaches X-Gtm-Server-Preview to the endpoint the user enters).
- Host permissions `<all_urls>`: Tag debugging must work on whichever site the user is auditing; requests to any tracking endpoint must be observable.
- Single purpose: "Inspect, debug and validate website tracking tags."

## Mağaza gizlilik beyanı (2026-08-01'den sonraki politikaya göre)

Chrome Web Store 1 Ağustos 2026'da Limited Use ve Disclosure kurallarını sıkılaştırdı. **"Veri toplamıyorum"
beyanı bizim için YANLIŞ** — politika, veri cihazda kalsa bile "işleme"nin beyan edilmesini istiyor ve
"web browsing activity" tanımı tam olarak bizim yaptığımız şey (ziyaret edilen URL'ler, istek/yanıt içeriği,
çerezler). Doğru beyan, istisnadan yararlanmak: veriyi yalnızca kullanıcıya gösterilen özellik için işliyoruz.

**Privacy practices sekmesinde işaretlenecekler:**
- ✔ Website content
- ✔ Web history / user activity

**Yanına yazılacak metin:**

```
Tag Master reads the tracking requests, page data and cookies of the sites the user chooses to inspect, in
order to display them in its own side panel. This is the extension's single, user-facing purpose. All of it
is stored locally in the user's browser (IndexedDB and chrome.storage). Nothing is transmitted to the
developer or to any third party. There is no account, no telemetry and no backend server.
```

**Üç beyan kutusu** işaretlenecek (satmıyoruz, tek amaç dışında kullanmıyoruz, kredi değerlendirmesi yok).

**Uzak kod sorusu: Hayır.** (v1.5.0'da harici `script.src` dalı kaldırıldıktan sonra bu doğru.)

```
No. All extension logic is bundled in the package. The GTM Injector does not fetch or execute code from a
remote server: it takes a Google Tag Manager snippet that the user pastes manually and writes it into the
page as an inline script in the page's own context, so the user can test their own container. Pastes
containing a <script src> tag are rejected. eval() and new Function() are not used anywhere.
```

**Not:** `tagmaster.dev/privacy` sayfasına Limited Use taahhüdü eklendi (politika bunu ürüne ait bir sitede
zorunlu kılıyor) ve aynı bildirim eklentinin karşılama ekranında da gösteriliyor ("in the Product's user
interface" şartı).

## Dağıtım (ilk 30 gün, sıfır bütçe, sırayla)

1. Önce listing düzelt + v1.4.0 yayınla (bayatlık da bir sıralama sinyali).
2. **Araç listesi outreach:** Analytics Mania "Top 20 GTM Extensions" (iletişim formu), MeasureSchool Top 11,
   GA4 Optimizer, measureminds, online-metrics, measureu. Açı: "MV3-native GTM injector + Consent Mode V2 audit".
3. **Measure Slack** (#measure): 2 hafta soru cevapla, sonra tools kanalında paylaş. Drive-by post yapma.
4. **Reddit** r/GoogleTagManager + r/GoogleAnalytics: "builder story" formatı — "Tag Assistant bana yalan
   söylediği ve dataLayer Inspector+ injector'ını kaybettiği için kendim yazdım, feedback?"
5. **tagmaster.dev'e 3 sayfa:** "Tag Assistant alternative (2026)", "How to inject GTM after dataLayer
   Inspector+ removed it", "Debugging Consent Mode V2". Düşük rekabet, yüksek niyet.
6. LinkedIn: 30-60 sn'lik tek-görev demo videoları (hazır post taslağı var).
7. **Yorum çarkı:** N başarılı oturumdan sonra nazik store-review isteği (organik, keyword'lü yorumlar şart;
   17 tanıdık yorumu bir bakışta belli oluyor).

## Özellik boşluk sıralaması (rakip analizi, uygulanma durumu)

✅ v1.4.0'da: hit blocking, GA4 DebugView toggle, CSV export, +9 analytics vendor, UTM/click-ID tespiti
⏭ Sonraki: GTM Preview enhancer (Stape'in büyüme motoru), computed dataLayer state (DataSlayer 3-kolon),
per-vendor açma/kapama ayarı, hit'lere not + oturum paylaşımı (Omnibug/ObservePoint), container swap
(dataLayer Inspector+'ın kaybettiği ikinci özellik), sGTM response inspection, Firefox/Edge build'leri,
GA4 şema doğrulamasında verdict'ler (pass/warn/fail), kayıt modu (sayfalar arası journey).
