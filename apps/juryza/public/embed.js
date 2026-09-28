/*!
 * Juryza gallery embed.
 *
 *   <div data-juryza-event="my-hackathon" data-theme="dark" data-limit="8"></div>
 *   <script async src="https://your-juryza.example/embed.js"></script>
 *
 * Replaces each placeholder with an iframe of /embed/<slug> that resizes itself
 * to its content (the frame posts its height; only messages from that frame and
 * this origin are trusted). Optional attributes: data-theme (light|dark),
 * data-limit (1–48), data-transparent ("1").
 */
(() => {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : window.location.origin;
  var frames = [];

  function mount(el) {
    if (el.getAttribute("data-juryza-mounted")) return;
    var slug = el.getAttribute("data-juryza-event");
    if (!slug) return;
    el.setAttribute("data-juryza-mounted", "1");

    var params = new URLSearchParams();
    ["theme", "limit", "transparent"].forEach((k) => {
      var v = el.getAttribute("data-" + k);
      if (v) params.set(k, v);
    });
    var qs = params.toString();

    var iframe = document.createElement("iframe");
    iframe.src = origin + "/embed/" + encodeURIComponent(slug) + (qs ? "?" + qs : "");
    iframe.title = "Hackathon projects";
    iframe.loading = "lazy";
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = "width:100%;height:480px;border:0;display:block;color-scheme:normal;background:transparent";
    el.innerHTML = "";
    el.appendChild(iframe);
    frames.push(iframe);
  }

  window.addEventListener("message", (e) => {
    if (e.origin !== origin || !e.data || e.data.type !== "juryza:embed-height") return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        var h = Number(e.data.height);
        if (h > 0 && h < 20000) frames[i].style.height = h + "px";
      }
    }
  });

  function scan() {
    document.querySelectorAll("[data-juryza-event]").forEach(mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
