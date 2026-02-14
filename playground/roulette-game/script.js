(function () {
  "use strict";

  // ---------- 고정 요구사항 ----------
  var DEFAULT_ITEMS = ["투시리", "토시리", "사랑해", "너무", "많이"];
  var MIN_ITEMS = 2;
  var MAX_ITEMS = 5;

  // 파스텔 팔레트(조화/명도 통일)
  var SEGMENT_COLORS = ["#FDE2E4", "#E2F0CB", "#BEE1E6", "#FFF1C1", "#E8D7F1"];

  // ---------- DOM ----------
  var canvas = document.getElementById("wheel");
  var ctx = canvas.getContext("2d");
  var count = document.getElementById("count");
  var countValue = document.getElementById("countValue");
  var inputs = document.getElementById("inputs");
  var message = document.getElementById("message");
  var resultValue = document.getElementById("resultValue");
  var spinBtn = document.getElementById("spin");

  // ---------- 상태 ----------
  var itemCount = 5;
  var rotationDeg = 0; // 0 = 처음 상태
  var spinning = false;

  // ---------- 유틸 ----------
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function getLabels() {
    var labels = [];
    for (var i = 0; i < itemCount; i++) {
      var el = document.getElementById("item-" + i);
      var v = el ? el.value.trim() : "";
      labels.push(v || "항목 " + (i + 1));
    }
    return labels;
  }

  function setMessage(text, ok) {
    message.textContent = text || "";
    message.classList.toggle("ok", !!ok);
  }

  function canSpin() {
    var labels = getLabels();
    var filled = labels.filter(function (t) {
      return t.trim().length > 0;
    }).length;
    return itemCount >= MIN_ITEMS && filled >= MIN_ITEMS && !spinning;
  }

  // ---------- 입력 UI ----------
  function renderInputs() {
    inputs.innerHTML = "";
    for (var i = 0; i < itemCount; i++) {
      var row = document.createElement("div");
      row.className = "input-row";

      var label = document.createElement("label");
      label.setAttribute("for", "item-" + i);
      label.textContent = "항목 " + (i + 1);

      var input = document.createElement("input");
      input.id = "item-" + i;
      input.type = "text";
      input.value = DEFAULT_ITEMS[i] != null ? DEFAULT_ITEMS[i] : "";
      input.placeholder = "예: 치킨, 피자, 떡볶이";
      input.autocomplete = "off";

      row.appendChild(label);
      row.appendChild(input);
      inputs.appendChild(row);
    }
  }

  // ---------- 캔버스 크기 ----------
  function resizeCanvasToCSS() {
    // CSS로 렌더되는 실제 픽셀 크기(clientWidth/Height)를 기준으로 캔버스 해상도를 맞춤
    var rect = canvas.getBoundingClientRect();
    var size = Math.floor(Math.min(rect.width, rect.height));
    size = clamp(size || 420, 260, 560);

    var dpr = window.devicePixelRatio || 1;
    var px = Math.floor(size * dpr);
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    return { size: size, dpr: dpr };
  }

  // ---------- 룰렛 그리기 ----------
  function fitText(ctx2, text, maxWidth, basePx, minPx) {
    var px = basePx;
    while (px > minPx) {
      ctx2.font = "800 " + px + "px system-ui, -apple-system, Segoe UI, Roboto, Arial, \"Apple SD Gothic Neo\", \"Malgun Gothic\", sans-serif";
      if (ctx2.measureText(text).width <= maxWidth) return px;
      px -= 1;
    }
    return minPx;
  }

  function ellipsize(ctx2, text, maxWidth) {
    if (ctx2.measureText(text).width <= maxWidth) return text;
    var t = text;
    while (t.length > 1) {
      t = t.slice(0, -1);
      var candidate = t + "…";
      if (ctx2.measureText(candidate).width <= maxWidth) return candidate;
    }
    return "…";
  }

  function drawWheel() {
    var labels = getLabels();
    var n = labels.length;
    if (n === 0) return;

    var info = resizeCanvasToCSS();
    var dpr = info.dpr;
    var size = canvas.width / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    var cx = size / 2;
    var cy = size / 2;
    var outer = size / 2 - 10;
    var inner = outer * 0.17; // 중앙 허브 느낌

    // 링(바깥 테두리) — 귀엽고 미니멀
    ctx.beginPath();
    ctx.arc(cx, cy, outer + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    var segment = (Math.PI * 2) / n;
    var rot = (rotationDeg * Math.PI) / 180;
    var topOffset = -Math.PI / 2; // 12시 시작

    // 1) 조각 먼저
    for (var i = 0; i < n; i++) {
      var a0 = topOffset + i * segment + rot;
      var a1 = a0 + segment;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outer, a0, a1);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();

      ctx.strokeStyle = "rgba(17,24,39,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2) 중앙 허브
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(17,24,39,0.08)";
    ctx.stroke();

    // 3) 텍스트 (정가운데: 부채꼴 중심점 + 외곽선 + 자동 축소/줄임표)
    // 원형 부채꼴의 무게중심(centroid)까지의 거리:
    // r = (4 * R * sin(theta/2)) / (3 * theta)
    var centroidR = (4 * outer * Math.sin(segment / 2)) / (3 * segment);
    var textR = clamp(centroidR, inner + 18, outer - 36);
    var basePx = clamp(Math.floor(size / (n * 1.85)), 14, 22);
    var minPx = 12;

    for (var j = 0; j < n; j++) {
      var a = topOffset + j * segment + rot + segment / 2;
      var tx = cx + textR * Math.sin(a);
      var ty = cy - textR * Math.cos(a);

      ctx.save();
      ctx.translate(tx, ty);

      // “칸의 가운데”로 보이게: 회전 없이(수평) 중앙 정렬
      // 회전을 주면 글자 박스가 좌/우로 쏠려 보일 수 있어 기본값은 0으로 둠.
      ctx.rotate(0);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 해당 반지름(textR)에서의 부채꼴 가로폭(현 길이)을 기준으로 최대 폭 계산
      var maxWidth = 2 * textR * Math.sin(segment / 2) * 0.92;
      var text = labels[j];

      // 폰트 크기 맞춤 → 그래도 길면 줄임표
      var px = fitText(ctx, text, maxWidth, basePx, minPx);
      ctx.font =
        "800 " +
        px +
        "px system-ui, -apple-system, Segoe UI, Roboto, Arial, \"Apple SD Gothic Neo\", \"Malgun Gothic\", sans-serif";
      text = ellipsize(ctx, text, maxWidth);

      // 외곽선(흰색) + 본문(짙은색)으로 파스텔에서도 또렷하게
      ctx.lineWidth = Math.max(3, Math.floor(px / 6));
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = "rgba(17,24,39,0.84)";
      ctx.fillText(text, 0, 0);

      ctx.restore();
    }
  }

  // 포인터(12시)가 가리키는 조각 인덱스 계산
  function getWinnerIndex() {
    var n = itemCount;
    // top(12시) 기준: -90도 위치에서 회전량만큼 반대로 이동
    var topDeg = ((270 - rotationDeg) % 360 + 360) % 360;
    var segDeg = 360 / n;
    return Math.floor(topDeg / segDeg) % n;
  }

  // ---------- 회전 ----------
  function spin() {
    if (!canSpin()) {
      setMessage("항목은 최소 2개 이상 필요해요. 입력을 확인해 주세요.", false);
      return;
    }

    spinning = true;
    spinBtn.disabled = true;
    setMessage("", true);
    resultValue.textContent = "…";

    var turns = 6 + Math.random() * 4; // 6~10
    var total = turns * 360 + Math.random() * 60; // 살짝 랜덤 오프셋
    var duration = 4200 + Math.random() * 700; // 4.2~4.9초
    var start = null;
    var from = rotationDeg % 360;

    function tick(tNow) {
      if (start == null) start = tNow;
      var t = clamp((tNow - start) / duration, 0, 1);
      var p = easeOutCubic(t);
      rotationDeg = from + p * total;
      drawWheel();

      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }

      var labels = getLabels();
      var idx = getWinnerIndex();
      resultValue.textContent = labels[idx] || "—";
      spinning = false;
      spinBtn.disabled = !canSpin();
    }

    requestAnimationFrame(tick);
  }

  // ---------- 이벤트 ----------
  function syncUI() {
    countValue.textContent = String(itemCount);
    spinBtn.disabled = !canSpin();
    if (itemCount < MIN_ITEMS) {
      setMessage("항목은 최소 2개 이상 필요해요.", false);
    } else {
      setMessage("", true);
    }
  }

  count.addEventListener("input", function () {
    itemCount = clamp(parseInt(count.value, 10) || 5, MIN_ITEMS, MAX_ITEMS);
    count.value = String(itemCount);
    renderInputs();
    syncUI();
    drawWheel();
  });

  inputs.addEventListener("input", function () {
    syncUI();
    drawWheel();
  });

  spinBtn.addEventListener("click", spin);

  window.addEventListener("resize", function () {
    drawWheel();
  });

  // ---------- 초기화 ----------
  count.min = String(MIN_ITEMS);
  count.max = String(MAX_ITEMS);
  count.value = String(itemCount);
  renderInputs();
  syncUI();

  // 레이아웃 적용 후 한 번 더 렌더
  requestAnimationFrame(function () {
    drawWheel();
  });
})();

