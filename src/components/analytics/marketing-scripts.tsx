import Script from "next/script";
import { getMarketingTrackingSettings } from "@/lib/settings/marketing";

export async function MarketingHeadTags() {
  const settings = await getMarketingTrackingSettings();

  return (
    <>
      {settings.googleSearchConsoleVerification ? (
        <meta name="google-site-verification" content={settings.googleSearchConsoleVerification} />
      ) : null}
      {settings.bingWebmasterVerification ? (
        <meta name="msvalidate.01" content={settings.bingWebmasterVerification} />
      ) : null}
      {settings.facebookDomainVerification ? (
        <meta name="facebook-domain-verification" content={settings.facebookDomainVerification} />
      ) : null}
      {settings.customScriptsEnabled && settings.customHeadScript ? (
        <Script id="zeylora-custom-head-script" strategy="afterInteractive">
          {settings.customHeadScript}
        </Script>
      ) : null}
    </>
  );
}

export async function MarketingBodyScripts() {
  const settings = await getMarketingTrackingSettings();
  const googleTagId = settings.ga4MeasurementId || settings.googleAdsConversionId;

  return (
    <>
      {googleTagId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`} strategy="afterInteractive" />
          <Script id="zeylora-google-tags" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = window.gtag || gtag;
              gtag('js', new Date());
              ${settings.ga4MeasurementId ? `gtag('config', '${escapeJs(settings.ga4MeasurementId)}');` : ""}
              ${settings.googleAdsConversionId ? `gtag('config', '${escapeJs(settings.googleAdsConversionId)}');` : ""}
            `}
          </Script>
        </>
      ) : null}

      {settings.metaPixelId ? (
        <Script id="zeylora-meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${escapeJs(settings.metaPixelId)}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}

      {settings.tiktokPixelId ? (
        <Script id="zeylora-tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
              ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load('${escapeJs(settings.tiktokPixelId)}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      ) : null}

      {settings.pinterestTagId ? (
        <Script id="zeylora-pinterest-tag" strategy="afterInteractive">
          {`
            !function(e){if(!window.pintrk){window.pintrk = function () {
            window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
            n=window.pintrk;n.queue=[],n.version="3.0";var
            t=document.createElement("script");t.async=!0,t.src=e;var
            r=document.getElementsByTagName("script")[0];
            r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
            pintrk('load', '${escapeJs(settings.pinterestTagId)}');
            pintrk('page');
          `}
        </Script>
      ) : null}

      <Script id="zeylora-tracking-helpers" strategy="afterInteractive">
        {`
          window.zeyloraTrackSignup = function(){ window.zeyloraTrack && window.zeyloraTrack('signup'); };
          window.zeyloraTrackLogin = function(){ window.zeyloraTrack && window.zeyloraTrack('login'); };
          window.zeyloraTrackPreviewGenerated = function(){ window.zeyloraTrack && window.zeyloraTrack('preview_generated'); };
          window.zeyloraTrackCleanExport = function(){ window.zeyloraTrack && window.zeyloraTrack('clean_export_clicked'); };
          window.zeyloraTrackCheckoutStarted = function(){ window.zeyloraTrack && window.zeyloraTrack('checkout_started'); };
          window.zeyloraTrackPurchase = function(value, currency){ window.zeyloraTrack && window.zeyloraTrack('purchase', { value: value, currency: currency || 'USD' }); };
        `}
      </Script>

      {settings.customScriptsEnabled && settings.customBodyScript ? (
        <Script id="zeylora-custom-body-script" strategy="afterInteractive">
          {settings.customBodyScript}
        </Script>
      ) : null}
    </>
  );
}

function escapeJs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
