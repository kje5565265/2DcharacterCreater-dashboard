/* 갤러리(재생 모드) — 이미 만들어진 산출물을 단계 순서대로 되짚어 본다.
   2단계(라이브 실행)에서 같은 단계 카드에 진행 상태를 얹을 것이므로 렌더 함수를 단계 단위로 나눠 둔다. */

const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
// 공개용 읽기 전용 사본(export_static.py)은 서버 없이 정적 파일만으로 열린다 — 경로를 상대로 바꾸고,
//  API 대신 미리 떠 둔 JSON 을 읽고, 만들기 · 고르기 버튼은 숨긴다 (2026-10-06 사용자: 이력서에서 열어 볼 수 있게)
const STATIC = !!window.DEMO_STATIC;
const url = (p) => (STATIC ? "files/" : "/files/") + p.split("/").map(encodeURIComponent).join("/");
const kb = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";

let STAGES = [];
let current = null;
let MON = null;

/* ---------- 산출물 배경 ----------
   연한 얼룩은 어두운 배경에서 광택처럼 보여 묻힌다. 밝은 배경과 체크무늬로도 볼 수 있어야 한다. */
const BACKDROPS = {
  "밝음": { bg: "#ece9e4", check: "none" },
  "어두움": { bg: "#3a3630", check: "none" },
  "체크": {
    bg: "#e2ded8",
    check: "linear-gradient(45deg,#cdc7bf 25%,transparent 25%,transparent 75%,#cdc7bf 75%)," +
      "linear-gradient(45deg,#cdc7bf 25%,transparent 25%,transparent 75%,#cdc7bf 75%)"
  }
};

function setBackdrop(name) {
  const b = BACKDROPS[name];
  document.documentElement.style.setProperty("--art-bg", b.bg);
  document.documentElement.style.setProperty("--art-check", b.check);
  document.querySelectorAll("[data-backdrop]").forEach(btn =>
    btn.setAttribute("aria-pressed", String(btn.dataset.backdrop === name)));
}

/* ---------- 라이트박스 ---------- */

const lb = document.getElementById("lightbox");

function openArt(item) {
  document.getElementById("lbTitle").textContent = item.label;
  const size = item.w ? `${item.w} × ${item.h}` : "";
  document.getElementById("lbMeta").textContent = [size, kb(item.bytes), item.path].filter(Boolean).join("  ·  ");
  document.getElementById("lbImg").src = url(item.path) + (item.ver ? `?v=${item.ver}` : "");
  lb.hidden = false;
}
const closeArt = () => { lb.hidden = true; document.getElementById("lbImg").src = ""; };

document.getElementById("lbClose").addEventListener("click", closeArt);
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.id === "lbBody") closeArt(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeArt(); });

/* ---------- 산출물 카드 ---------- */

function artCard(item, tall) {
  // 스프라이트 시트 · 4방향 GIF 는 가로로 매우 길다. 정사각 칸에 넣으면 납작한 선이 되어 안 보인다 —
  // 가로 비율이 큰 것은 한 줄을 통째로 쓰게 한다.
  const panorama = item.w && item.h && item.w / item.h >= 2.2;
  // **사람이 판단해야 하는 그림은 크게 띄운다.** 파츠 검수(시안↔조립 · 관절 시험)가
  //  132px 칸에 들어가 납작해졌다 — 가로비가 2.2 를 안 넘어 파노라마도 아니었다
  //  (2026-09-22 사용자). 판단용은 `big` 으로 표시해 한 줄을 쓰게 한다
  // 고른 시안은 **선택됨** 이다 — 규칙대로 테두리 + 배경으로 표시한다 (배지만으로는 약하다).
  // 확정본과 겉모습은 같고 **배지의 말로 갈린다** — `고른 시안` ↔ `확정된 시안`
  const fig = el("figure", "art" + (tall ? " tall" : "") + (panorama ? " panorama" : "")
    + (item.big ? " big" : "")
    + (item.chosen || item.selected ? " chosen" : "") + (item.sizeBad ? " bad" : ""));
  const btn = el("button", "thumb");
  btn.title = "크게 보기";
  const img = el("img");
  // 같은 이름으로 다시 그리면 브라우저가 옛 그림을 캐시에서 꺼낸다 — 바뀐 시각을 붙여 막는다
  img.src = url(item.path) + (item.ver ? `?v=${item.ver}` : "");
  img.alt = item.label;
  img.loading = "lazy";
  img.decoding = "async";
  btn.appendChild(img);
  btn.addEventListener("click", () => openArt(item));

  const cap = el("figcaption");
  // 다시 만들면 뒤에 쌓이므로 **어느 회차 것인지**를 알 수 있어야 한다 (2026-09-21 사용자)
  if (item.round) cap.appendChild(el("span", "art-round", `${item.round.no}회차`));
  cap.appendChild(document.createTextNode(item.label));
  const meta = el("span", "meta");
  const bits = [];
  if (item.w) bits.push(`${item.w}×${item.h}`);
  if (item.frames) bits.push(`${item.frames}프레임`);
  bits.push(kb(item.bytes));
  meta.textContent = bits.join(" · ");
  cap.appendChild(meta);

  fig.append(btn, cap);
  // 시안 아래 애니메이션 방식 한 줄 — 확정 전에 보고 고를 수 있게 (PLAN:mesh-tool-change §13.2 Q4).
  //  주문에 적은 방식과 안 맞으면 호박색(제약, UI 규칙 §3.1)
  if (item.animNote) fig.appendChild(el("p", "art-note" + (item.animWarn ? " warn" : ""), item.animNote));

  // 지금 확정돼 있는 시안의 이름. 바꾸기를 물을 때 **무엇을 대신하는지**를 말하려고 쓴다
  // 시안은 **고르는 물건**이다 — 갤러리에서도 고를 수 있어야 한다 (2026-09-18 사용자).
  // 다만 카드가 하는 일은 **고르기까지**다. 확정은 단계 아래 버튼 하나가 맡는다 (§3.8, 2026-09-21 사용자)
  if (item.pick != null && current) {
    const act = el("div", "art-act");
    if (item.sizeBad) {
      act.appendChild(el("span", "badge err", "규격 어긋남"));
      act.appendChild(el("span", "art-bad", item.sizeBad));
    } else if (item.dupOf) {
      // 앞 시안과 똑같은 그림이라 고를 이유가 없다
      act.appendChild(el("span", "badge", `${item.dupOf}안과 같은 그림`));
    } else if (item.chosen) {
      act.appendChild(el("span", "badge ok", "확정된 시안"));
    } else if (item.selected) {
      act.appendChild(el("span", "badge sel", "고른 시안"));
    } else {
      const b = el("button", "btn2", "이걸로 고르기");
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await fetch("/api/concepts/select", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: current, index: item.pick })
          }).then(r => r.json()).then(d => { if (d.error) throw new Error(d.error); });
          // 고르기는 **이 단계 안에서 끝나는 변화**다 — 화면 전체를 다시 그리지 않는다
          await refreshStage("concept");
        } catch (e) {
          act.replaceChildren(el("span", "art-bad", "실패 — " + e.message));
        }
      });
      act.appendChild(b);
    }
    fig.appendChild(act);
  }
  return fig;
}

function rigCard(item) {
  const c = el("div", "card");
  c.appendChild(el("h4", null, item.label));
  const dl = el("dl");
  const add = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, v)); };
  add("캔버스", item.canvas ? item.canvas.join(" × ") : "—");
  add("파츠", item.parts.length ? item.parts.join(", ") : "—");
  add("교체 그림", item.variants.length ? item.variants.join(", ") : "—");
  c.appendChild(dl);
  return c;
}

function specCard(item) {
  const c = el("div", "card");
  c.appendChild(el("h4", null, item.label));
  const dl = el("dl");
  const add = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, v)); };
  add("클립", `${item.clips}개`);
  add("총 프레임", `${item.frames}장`);
  add("PPU", item.ppu);
  add("바닥 오프셋", `${item.groundOffsetPx}px`);
  c.appendChild(dl);
  return c;
}

/* ---------- 단계 ---------- */

function renderStage(stage, index) {
  const wrap = el("section", "stage" + (stage.items.length ? " has" : ""));
  wrap.dataset.stage = stage.key;
  wrap.appendChild(el("div", "num", String(index + 1)));

  const head = el("div", "stage-head");
  head.appendChild(el("h3", null, stage.label));
  // 번호 색만으로 완료 · 대기 · 실패를 말하면 긴 갤러리를 훑을 때 안 읽힌다 — 배지를 함께 둔다
  const stat = stage.na ? el("span", "badge", "해당 없음")
    : stage.items.length ? el("span", "badge ok", `산출물 ${stage.items.length}개`)
      : el("span", "badge", "대기");
  stat.dataset.role = "stat";
  head.appendChild(stat);
  wrap.appendChild(head);
  wrap.appendChild(el("p", "stage-desc", stage.desc));
  // 멈춰 있으면 왜 멈췄고 뭘 하면 되는지 말한다 (2026-09-18 사용자)
  if (stage.todo) wrap.appendChild(el("div", "stage-todo", stage.todo));

  if (!stage.items.length) {
    // "아직 안 한 것"과 "이 종류엔 원래 없는 것"을 구분한다
    wrap.appendChild(el("div", "stage-none", stage.na ? "해당 없음 — " + stage.na : "아직 산출물이 없습니다"));
    if (stage.na) wrap.classList.add("na");
    return wrap;
  }

  // 무늬 단계는 전후 비교가 본질이라 쌍으로 묶는다
  if (stage.key === "pattern") {
    const grid = el("div", "grid wide");
    for (let i = 0; i < stage.items.length; i += 2) {
      const box = el("div", "pairwrap");
      const pair = el("div", "pair");
      pair.append(artCard(stage.items[i]), artCard(stage.items[i + 1]));
      box.appendChild(pair);
      grid.appendChild(box);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  const grid = el("div", "grid" + (["concept", "views", "engine"].includes(stage.key) ? " wide" : ""));
  const tall = stage.key === "concept" || stage.key === "views";
  for (const item of stage.items) {
    if (item.kind === "rig") grid.appendChild(rigCard(item));
    else if (item.kind === "spec") grid.appendChild(specCard(item));
    else grid.appendChild(artCard(item, tall));
  }
  wrap.appendChild(grid);
  if (stage.pick) wrap.appendChild(conceptCommit({ ...stage.pick, order: stage.order || null }));
  // **주문 이력은 이 몬스터에 붙박이로 남는다.** 위쪽 주문 자리에만 두면 새로고침 한 번,
  //  확정 한 번에 사라진다 — 그건 기록이 아니다 (2026-09-21 사용자).
  //  디스크(`order.json`)에서 읽으므로 화면 상태와 무관하게 늘 있다
  if (stage.order && (stage.order.said || []).length) {
    const said = renderSaid(stage.order);
    said.querySelector(".said-k").textContent = "이렇게 주문했습니다";
    wrap.appendChild(said);
  }
  return wrap;
}

/* 시안 다시 만들기 — **되돌릴 수 없고 2~3분 걸린다.** 바로 돌리지 않는다.

   두 가지를 지킨다 (2026-09-21 사용자).
   1. 지금 시안 3장이 사라진다는 것을 먼저 말한다
   2. **무엇을 바꿀지 적을 칸**을 연다. 같은 조건으로 다시 뽑으면 비슷한 것이 나오므로,
      다시 만드는 사람은 대개 바꾸고 싶은 것이 있다. 비워 두면 같은 조건으로 돌린다

   그리고 원문 · 참고 사진 · 축을 **반드시 함께 보낸다.** 전에는 모티프 이름 하나만 보내서
   사진과 설명을 넣어 겨우 맞춘 결과가 도로 풀렸다. */
function openRegen(box, order) {
  const panel = el("div", "regen");
  // 덮어쓰지 않고 **뒤에 쌓는다** — 지금 것을 잃을 걱정 없이 몇 번이고 더 뽑아 고르면 된다
  panel.appendChild(el("div", "regen-head", "시안을 더 만듭니다 — 지금 시안은 그대로 두고 아래에 3장이 더 생깁니다"));
  if (!order) {
    panel.appendChild(el("div", "regen-warn",
      "이 종류의 주문 내용이 남아 있지 않습니다. 위 「캐릭터 생성」에서 다시 주문해 주세요."));
  } else {
    const keep = el("ul", "regen-keep");
    keep.appendChild(el("li", null, `모티프 · 축은 그대로: ${order.motif} · `
      + [order.labels?.skeleton, order.labels?.movement, order.labels?.engage].filter(Boolean).join(" · ")));
    if ((order.refs || []).length) keep.appendChild(el("li", null, `참고 사진 ${order.refs.length}장을 그대로 씁니다`));
    panel.appendChild(keep);

    // **무엇을 그대로 쓰는지 글자로 보여준다.** 줄 수만 말하면 맞는지 확인할 수가 없다
    const said = renderSaid(order);
    if (said) panel.appendChild(said);

    const input = el("textarea", "field grow");
    input.rows = 3;
    input.placeholder = "무엇을 바꿀까요? 비워 두면 같은 조건으로 다시 뽑습니다\n예) 포장지를 더 많이 벗겨줘 / 표정을 3번 시안처럼";
    panel.appendChild(input);

    const act = el("div", "regen-act");
    const go = el("button", "go", "추가 시안 만들기");
    const fire = () => {
      const more = input.value.trim();
      startConcepts({ ...order, said: more ? [...(order.said || []), more] : (order.said || []) }, go);
      // 화면이 위로 올라가고 거기에 「지금까지 말한 것」과 진행 표시가 있다 —
      //  여기 같은 내용을 남겨 두면 또 두 벌이다 (2026-09-21 사용자)
      panel.remove();
    };
    growBox(input, fire);
    go.addEventListener("click", fire);
    const no = el("button", "btn2 keep-live", "취소");
    no.addEventListener("click", () => panel.remove());
    act.append(go, no);
    panel.appendChild(act);
  }
  box.querySelector(".regen")?.remove();     // 두 번 열리지 않게
  box.appendChild(panel);
  panel.querySelector("input")?.focus();
}

/* 시안 확정 — **단계에 하나뿐인 버튼**이다 (PLAN:demo-ui-rules §3.8).
   카드는 고르기까지만 하고, 되돌릴 수 없는 일은 여기서 한 번에 일어난다.
   자리는 다음 단계 바로 위다 — 여기서부터 뒤 단계가 이 그림을 쓰기 때문이다 (2026-09-21 사용자). */
function conceptCommit(pick) {
  const box = el("div", "commit");
  const n = pick.selected == null ? null : pick.selected + 1;

  if (pick.confirmed != null && pick.confirmed === pick.selected) {
    box.classList.add("done");
    box.appendChild(el("span", "commit-say", `${pick.confirmed + 1}안으로 확정했습니다 — 뒤 단계가 이 그림을 씁니다.`));
    box.appendChild(el("span", "commit-hint", "다른 시안을 고르면 다시 확정할 수 있습니다."));
    return box;
  }

  const go = el("button", "go", "선택한 시안 확정하고 다음 단계로");
  go.disabled = n == null;
  go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = "확정하는 중…";
    try {
      // 확정은 **없던 것이 생기는** 순간이다 — 「다음에 할 일」 패널이 새로 들어서므로
      //  자리에서 바꾸는 것으로는 안 되고 전체를 다시 짓는다. 대신 보던 위치는 지킨다
      const y = window.scrollY;
      await commitConcept(current, pick.selected);
      await showMonster(current);
      window.scrollTo(0, y);
    } catch (e) {
      box.appendChild(el("span", "commit-err", "실패 — " + e.message));
      go.disabled = false;
      go.textContent = "선택한 시안 확정하고 다음 단계로";
    }
  });
  box.appendChild(go);
  // 셋 다 마음에 안 들 수 있다 — 다시 뽑는 길을 **이 단계 안에** 남긴다
  const again = el("button", "btn2", "시안 더 만들기");
  again.addEventListener("click", () => openRegen(box, pick.order));
  box.appendChild(again);
  box.appendChild(el("span", "commit-hint", n == null
    ? "시안을 하나 고르면 확정할 수 있습니다."
    : pick.confirmed == null
      ? `${n}안으로 확정합니다. 확정 전까지는 몇 번이고 바꿀 수 있습니다.`
      : `${pick.confirmed + 1}안 대신 ${n}안으로 바꿔 확정합니다.`));
  return box;
}

/* ---------- 지표 ---------- */

function renderMetrics(mon) {
  const box = document.getElementById("metrics");
  box.replaceChildren();
  const get = (k) => mon.stages.find(s => s.key === k) || { items: [] };
  const spec = get("engine").items.find(i => i.kind === "spec");
  const images = mon.stages.reduce((n, s) =>
    n + s.items.filter(i => i.kind === "image" || i.kind === "gif").length, 0);
  const frames = get("render").items.reduce((n, i) => n + (i.frames || 0), 0);

  // 렌더 프레임 PNG 는 2026-10-06 정리 때 지웠다 — 없으면 엔진 시트에 든 프레임 수를 보인다
  const frameRow = frames || !(spec && spec.frames)
    ? ["렌더 프레임", `${frames || "—"}`, "원본 프레임"]
    : ["엔진 프레임", `${spec.frames}`, "시트에 든 프레임"];
  const rows = [
    ["입력", "1장", "AI 시안"],
    ["산출물", `${images}장`, "그림 · GIF"],
    frameRow,
    ["엔진 클립", spec ? `${spec.clips}개` : "—", "Unity 에셋"]
  ];
  for (const [label, value, sub] of rows) {
    const m = el("div", "metric");
    m.appendChild(el("b", null, value));
    m.appendChild(el("span", null, `${label} · ${sub}`));
    box.appendChild(m);
  }
}

/* 삭제 — **되돌릴 수 없다.** 한 번에 지우지 않고 무엇이 지워지는지 보여준 뒤 확인을 받는다. */
function deleteControl(mon) {
  const wrap = el("span", "del");
  const ask = el("button", "btn2 tiny danger", "삭제");
  ask.addEventListener("click", async () => {
    wrap.replaceChildren();
    const n = mon.stages.reduce((a, s) => a + s.items.length, 0);
    wrap.appendChild(el("span", "del-ask", `${mon.title} 의 산출물 ${n}개를 모두 지웁니다. 되돌릴 수 없습니다.`));
    const yes = el("button", "btn2 tiny danger", "지웁니다");
    const no = el("button", "btn2 tiny keep-live", "취소");   // 물어 놓고 무를 길은 남긴다
    yes.addEventListener("click", async () => {
      yes.disabled = no.disabled = true;
      try {
        const res = await fetch("/api/delete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monster: mon.name })
        });
        const data = await res.json();
        if (!res.ok || data.error) { wrap.replaceChildren(el("span", "del-err", data.error || `HTTP ${res.status}`)); return; }
        await init();                       // 목록을 다시 읽고 첫 화면으로
        if (data.unityLeft) {
          fail("삭제", new Error(`${data.files}개를 지웠습니다. Unity 쪽 에셋은 남아 있습니다 — 에디터에서 확인해 주세요`));
        }
      } catch (e) {
        wrap.replaceChildren(el("span", "del-err", "실패 — " + e.message));
      }
    });
    no.addEventListener("click", () => { wrap.replaceChildren(); wrap.appendChild(ask); });
    wrap.append(yes, no);
  });
  wrap.appendChild(ask);
  return wrap;
}

/* ---------- 한 종류 ---------- */

/* 주문 화면(`#order`)은 **만드는 자리**다. 이미 만든 것을 보고 있을 때는 필요 없다.

   늘 떠 있어서 오늘 문제가 줄줄이 나왔다 — 시안이 두 곳에 보이고, 같은 버튼이 두 곳에 생기고,
   진행 표시가 엉뚱한 데 떴다. **만드는 자리와 보는 자리를 가르면** 그 부류가 통째로 없어진다
   (2026-09-21 사용자). 단 **만드는 중에는 남긴다** — 진행 표시가 거기 뜬다. */
function showOrder(on) {
  document.getElementById("order").hidden = !on;
}

async function showMonster(name) {
  current = name;
  document.querySelectorAll(".mon").forEach(b =>
    b.setAttribute("aria-current", String(b.dataset.name === name)));
  document.getElementById("newBtn")?.setAttribute("aria-current", "false");
  showOrder(CONCEPT_RUNNING);

  const main = document.getElementById("main");
  main.replaceChildren(el("div", "empty", "불러오는 중…"));

  let mon;
  try {
    mon = await getJSON("/api/monster/" + encodeURIComponent(name));
  } catch (e) {
    fail("종류 불러오기", e);
    main.replaceChildren(el("div", "empty", "불러오지 못했습니다 — " + e.message));
    return;
  }
  if (mon.error) { main.replaceChildren(el("div", "empty", mon.error)); return; }

  main.replaceChildren();

  const head = el("div", "mon-head");
  head.appendChild(el("h2", null, mon.title));
  head.appendChild(el("span", "id", mon.name));
  const tag = el("span", "tag" + (mon.complete ? " ok" : ""),
    mon.complete ? "엔진까지 완료" : `진행 ${mon.stagesWithOutput}/${mon.stageCount} 단계`);
  head.appendChild(tag);
  // 원본 슬라임은 모든 종류의 몸이 나오는 뿌리라 지울 수 없다
  if (mon.name !== "Slime") head.appendChild(deleteControl(mon));
  main.appendChild(head);

  const bar = el("div", "toolbar");
  bar.appendChild(el("span", "lbl", "산출물 배경"));
  for (const name of Object.keys(BACKDROPS)) {
    const b = el("button", "chip", name);
    b.dataset.backdrop = name;
    b.addEventListener("click", () => setBackdrop(name));
    bar.appendChild(b);
  }
  main.appendChild(bar);
  setBackdrop(document.querySelector('[data-backdrop][aria-pressed="true"]')?.dataset.backdrop || "밝음");

  // 다음에 할 일은 **그 일이 일어날 단계 자리**에 둔다 — 맨 위에 두면 어느 단계 얘기인지 알 수 없다
  // (2026-09-18 사용자). 아직 산출물이 없는 첫 단계가 곧 다음에 돌아갈 단계다.
  let ready = null;
  try {
    ready = await getJSON("/api/ready/" + encodeURIComponent(name));
  } catch (e) {
    console.error("다음 단계 확인 실패", e);
  }
  // **할 일이 있을 때만 띄운다.** 다 만든 종류에 빈 패널을 남기면 아직 뭔가 남은 것으로 읽힌다.
  //  일반 경로는 서버가 할 일 하나(`action`)를 정해 주고, 제약(다관절)은 할 일이 없어도 말해야 한다
  const showNext = !!ready && (ready.general ? (ready.action !== null || ready.limited) : !mon.complete);

  renderMetrics(mon);
  MON = mon;
  stageEls.clear();
  let placed = false;
  // 시안을 아직 확정 안 했으면 **다음에 할 일은 1번 단계에 있다.** 그 단계가 이미 카드와
  //  확정 버튼으로 다 말하고 있으므로, 2번에 같은 말을 또 띄우지 않는다 (2026-09-21 사용자)
  const pickPending = mon.stages[0].pick && mon.stages[0].pick.confirmed == null;
  // **어느 단계의 일인지는 서버가 말한다.** 「산출물이 없는 첫 단계」로 추측하면, 만드는 일이
  //  다 끝나고 엔진만 남았을 때 엔진 칸에 "4방향부터 만들기" 가 떴다 (2026-09-22 사용자)
  const atKey = ready && ready.at && mon.stages.some(s => s.key === ready.at) ? ready.at : null;
  mon.stages.forEach((s, i) => {
    const sec = renderStage(s, i);
    const here = atKey ? s.key === atKey : (!s.items.length && !s.na);
    if (showNext && !placed && !pickPending && here) {
      const next = el("div", "nextstep" + (ready.limited ? " limited" : ""));
      // 이어지지 않는 종류에 "이어서 만듭니다" 라고 쓰면 거짓말이 된다
      next.appendChild(el("div", "nextstep-head",
        ready.limited ? "여기서 멈춥니다"
          : ready.action === "build" ? "여기부터 이어서 만듭니다"
            : "여기가 남았습니다"));
      next.appendChild(ready.action === "pick" ? animPickPanel(name, ready)
        : renderReadiness({ target: name, motif: mon.title, readiness: ready }));
      sec.appendChild(next);
      sec.classList.add("nexthere");
      placed = true;
    }
    stageEls.set(s.key, sec);
    main.appendChild(sec);
  });
  // 종류를 옮겨도 실행 중이면 진행 표시를 다시 얹는다
  if (RUN && RUN.monster === name) applyRun(RUN);
  // 애니메이션 검수 — 회차가 있는 종류만(새 흐름). 검수 GIF 칸 안에 클립 카드를 붙인다 (UI 규칙 §3.12)
  const rev = stageEls.get("review");
  if (rev) renderReview(name, rev);
}

/* ---------- 애니메이션 방식 — 두 AI 의 판단이 엇갈렸을 때 (PLAN:mesh-tool-change §13.2 Q3) ----------
   두 의견을 **나란히** 보여 준다. 고르기는 카드(몇 번이고 바꿀 수 있다), 확정은 바깥 버튼 하나(UI 규칙 §3.8).
   고르기 어렵다면 원하는 느낌을 적어 보내면 두 AI 가 그 설명을 함께 보고 다시 판단한다. */
let ANIM_CHOICE = null;

function animPickPanel(name, ready) {
  const box = el("div", "anim-pick");
  box.appendChild(el("p", "choose-sub", ready.madeNote || ""));
  if (ready.pickNote) {
    const n = el("div", "review-why");
    n.appendChild(el("span", "said-k", "덧붙인 설명"));
    n.appendChild(el("span", null, `“${ready.pickNote}”`));
    box.appendChild(n);
  }
  const opts = el("div", "path-opts");
  for (const op of ready.opinions || []) {
    const b = el("button", "path");
    b.disabled = !op.anim;
    b.setAttribute("aria-pressed", String(ANIM_CHOICE === op.anim && !!op.anim));
    const t = el("div", "path-title");
    t.appendChild(document.createTextNode(op.animKo));
    t.appendChild(el("span", "badge", `${op.who} 의견`));
    if (ANIM_CHOICE === op.anim && op.anim) t.appendChild(el("span", "badge sel", "선택됨"));
    b.appendChild(t);
    b.appendChild(el("p", "path-desc", op.why || "근거를 받지 못했습니다"));
    b.addEventListener("click", () => { ANIM_CHOICE = op.anim; showMonster(name); });
    opts.appendChild(b);
  }
  box.appendChild(opts);

  const act = el("div", "review-act");
  const go = el("button", "go", "이 방식으로 확정하고 만들기");
  go.disabled = !ANIM_CHOICE;
  go.addEventListener("click", async () => {
    const r = await fetch("/api/anim/pick", { method: "POST", headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ monster: name, anim: ANIM_CHOICE }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { fail("방식 확정", new Error(d.error || `HTTP ${r.status}`)); return; }
    ANIM_CHOICE = null;
    await startRun(name);
  });
  act.appendChild(go);
  act.appendChild(el("span", "choose-sub", ANIM_CHOICE
    ? `${ANIM_CHOICE === "mesh" ? "메시" : "파츠"}로 확정합니다. 확정 전까지는 몇 번이고 바꿀 수 있습니다`
    : "의견 하나를 고르면 확정할 수 있습니다"));
  box.appendChild(act);

  // 고르기 어려우면 — 원하는 느낌을 설명해 다시 판단 (여러 줄 · Ctrl+Enter, §3.8.3)
  const fb = el("div", "review-fb");
  const ta = el("textarea", "field");
  ta.rows = 2;
  ta.placeholder = "원하는 느낌 — 예: 말랑하게 출렁이는 느낌 / 딱딱한 돌 조각이 덜그럭거리는 느낌 (Ctrl+Enter 로 보내기)";
  const send = el("button", "btn2", "설명을 덧붙여 다시 판단하기");
  const go2 = async () => {
    const note = ta.value.trim();
    if (!note) { ta.focus(); return; }
    const r = await fetch("/api/anim/rejudge", { method: "POST", headers: { "Content-Type": "application/json" },
                                                 body: JSON.stringify({ monster: name, note }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { ta.value = note; fail("다시 판단", new Error(d.error || `HTTP ${r.status}`)); return; }
    applyRun(d);
  };
  send.addEventListener("click", go2);
  fb.append(growBox(ta, go2), send);
  box.appendChild(fb);
  return box;
}

/* ---------- 애니메이션 검수 (PLAN:mesh-tool-change §4.6 · UI 규칙 §3.12) ----------
   클립마다 따로 정한다 — 확정하거나, 고칠 점을 적어 보내면 그 부분만 다시 만들어 **새 회차로 쌓는다.** */

const KIND_KO = { motion: "동작 재설계", hidden: "가려진 몸 다시 그리기", joints: "관절 점 다시 찍기",
                  parts: "파츠 그림 다시", tool: "도구 수정이 필요한 피드백", switch: "방식 전환" };
const REVIEW_VIEW = {};      // 클립마다 지금 보고 있는 회차 — 다시 그려도 보던 회차를 지킨다(§3.9)
const REVIEW_PENDING = {};   // 보낸 고칠 점 — 다시 만드는 동안 글을 세워 둔다(§3.9)

async function renderReview(name, sec) {
  let st;
  try { st = await getJSON("/api/anim/state/" + encodeURIComponent(name)); } catch (e) { return; }
  if (current !== name) return;
  const clips = Object.entries(st.clips || {}).filter(([, v]) => v.rounds.length);
  sec.querySelector(".review-box")?.remove();
  if (!clips.length) return;
  const box = el("div", "review-box");
  const done = clips.filter(([, v]) => v.ok).length;
  box.appendChild(el("div", "review-head", `애니메이션 ${clips.length}개 중 ${done}개 확인했습니다`));
  box.appendChild(el("p", "review-desc",
    "클립마다 GIF 를 보고 확정하거나 고칠 점을 적어 주세요. 고칠 점을 보내면 그 부분만 다시 만들어 새 회차로 쌓습니다 — " +
    "앞 회차는 지워지지 않습니다. 모든 클립을 확정하면 엔진 에셋을 만들 수 있습니다."));
  const grid = el("div", "review-grid");
  for (const [stem, v] of clips) grid.appendChild(reviewCard(name, stem, v));
  box.appendChild(grid);
  sec.appendChild(box);
}

function reviewCard(name, stem, v) {
  const card = el("div", "review-card" + (v.ok ? " oked" : ""));
  const rounds = v.rounds;
  const last = rounds[rounds.length - 1];
  const shown = rounds.find(r => r.round === REVIEW_VIEW[name + "/" + stem]) || last;

  const head = el("div", "review-card-head");
  head.appendChild(el("b", null, CLIP_KO[stem] || stem));
  if (v.ok) head.appendChild(el("span", "badge ok", "확정됨"));
  if (shown.amber) head.appendChild(el("span", "amber-note", "검사 미통과 — 자동 재설계 3회 모두 기준에 못 미쳤습니다"));
  card.appendChild(head);

  const img = el("img", "review-gif");
  img.src = url(shown.gif);          // 회차마다 경로가 달라 캐시가 섞이지 않는다
  img.alt = `${stem} ${shown.round}회차`;
  card.appendChild(img);

  // 회차 칩 — 보기 토글이다(§3.12). 누르면 그 회차를 보여 준다
  if (rounds.length > 1) {
    const chips = el("div", "review-rounds");
    chips.appendChild(el("span", "lbl", "회차"));
    for (const r of rounds) {
      const c = el("button", "chip keep-live", `${r.round}회차`);
      c.setAttribute("aria-pressed", String(r.round === shown.round));
      c.addEventListener("click", () => { REVIEW_VIEW[name + "/" + stem] = r.round; renderReview(name, stageEls.get("review")); });
      chips.appendChild(c);
    }
    card.appendChild(chips);
  }
  // 이 회차가 왜 생겼나 — 준 피드백과 판정
  const fb = shown.feedback || {};
  if (fb.text) {
    const why = el("div", "review-why");
    why.appendChild(el("span", "said-k", "고칠 점"));
    why.appendChild(el("span", null, `“${fb.text}”`));
    if (fb.verdict && fb.verdict.kinds) why.appendChild(el("span", "badge",
      fb.verdict.kinds.map(k => KIND_KO[k] || k).join(" · ") + "로 판단했습니다"));
    card.appendChild(why);
  }

  const act = el("div", "review-act");
  if (v.ok) {
    const undo = el("button", "btn2", "확정 취소");
    undo.addEventListener("click", () => animPost("/api/anim/unok", { monster: name, stem }));
    act.appendChild(undo);
  } else {
    const ok = el("button", "go", `${shown.round}회차로 확정`);
    ok.addEventListener("click", () => animPost("/api/anim/ok", { monster: name, stem, round: shown.round }));
    act.appendChild(ok);
  }
  card.appendChild(act);

  // 고칠 점 — 여러 줄 · Ctrl+Enter (§3.8.3). 보내는 동안 글을 세워 둔다 (§3.9)
  const pend = REVIEW_PENDING[name + "/" + stem];
  if (pend) {
    const p = el("div", "review-pending");
    p.appendChild(el("span", "spin"));
    p.appendChild(el("span", null, `요청 중 — “${pend}”  ·  판정 → 다시 만들기 · 수 분 걸립니다`));
    card.appendChild(p);
  }
  if (pend === undefined) {
    const fbBox = el("div", "review-fb");
    const ta = el("textarea", "field");
    ta.rows = 2;
    ta.placeholder = "고칠 점 — 예: 공격인데 아이들처럼 보인다 (Ctrl+Enter 로 보내기)";
    const send = el("button", "btn2", "고칠 점 보내고 다시 만들기");
    const go = () => sendFeedback(name, stem, ta, send);
    send.addEventListener("click", go);
    fbBox.append(growBox(ta, go), send);
    card.appendChild(fbBox);
  }
  const conf = REVIEW_CONFIRM[name + "/" + stem];
  if (conf) card.appendChild(switchConfirm(name, stem, conf));
  return card;
}

const CLIP_KO = { idle: "아이들", walk: "걷기", attack: "공격", hit: "피격", death: "죽음", respawn: "리스폰",
                  battle_idle: "전투 대기" };
const REVIEW_CONFIRM = {};   // 방식 전환 확인 대기 — {message, text}

async function animPost(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data.error) { fail("애니메이션 검수", new Error(data.error || `HTTP ${res.status}`)); return null; }
  // 확정 · 취소는 **그 칸만** 다시 그린다 — 다음 할 일(엔진 버튼)이 바뀔 수 있어 몬스터 화면을 다시 부른다
  const y = window.scrollY;
  await showMonster(body.monster);
  window.scrollTo(0, y);
  return data;
}

async function sendFeedback(name, stem, ta, btn) {
  const text = ta.value.trim();
  if (!text) { ta.focus(); return; }
  REVIEW_PENDING[name + "/" + stem] = text;
  renderReview(name, stageEls.get("review"));
  const res = await fetch("/api/anim/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
                                                   body: JSON.stringify({ monster: name, stem, text }) });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data.error) {
    delete REVIEW_PENDING[name + "/" + stem];
    await renderReview(name, stageEls.get("review"));
    // 실패하면 쓴 글을 칸에 돌려준다 (§3.9)
    const again = [...document.querySelectorAll(".review-card")].find(c => c.querySelector("b")?.textContent === (CLIP_KO[stem] || stem));
    const box = again?.querySelector("textarea");
    if (box) box.value = text;
    fail("고칠 점 보내기", new Error(data.error || `HTTP ${res.status}`));
    return;
  }
  if (data.queuedNow) REVIEW_PENDING[name + "/" + stem] = text + "  (앞 작업이 끝나면 이어서 합니다)";
  applyRun(data);
}

function switchConfirm(name, stem, conf) {
  const p = el("div", "review-confirm");
  p.appendChild(el("div", null, conf.message));
  const yes = el("button", "go", "방식 바꿔 다시 만들기");
  yes.addEventListener("click", async () => {
    delete REVIEW_CONFIRM[name + "/" + stem];
    REVIEW_PENDING[name + "/" + stem] = conf.text;
    const res = await fetch("/api/anim/regenerate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monster: name, stem, text: conf.text, kinds: ["switch"] }) });
    const data = await res.json().catch(() => ({}));
    if (data.error) { delete REVIEW_PENDING[name + "/" + stem]; fail("방식 전환", new Error(data.error)); }
    else applyRun(data);
    renderReview(name, stageEls.get("review"));
  });
  const no = el("button", "btn2", "그대로 두기");
  no.addEventListener("click", () => { delete REVIEW_CONFIRM[name + "/" + stem]; renderReview(name, stageEls.get("review")); });
  const row = el("div", "review-act");
  row.append(yes, no);
  p.appendChild(row);
  return p;
}

/* 피드백 작업이 끝나면 — 확인 요청이면 카드에 묻고, 아니면 새 회차를 그린다 */
function reviewDone(ev) {
  const stem = RUN && RUN.feedbackStem;
  const name = RUN && RUN.monster;
  if (!stem || !name) return;
  const key = name + "/" + stem;
  const text = (REVIEW_PENDING[key] || "").replace(/  \(앞 작업이.*$/, "");
  delete REVIEW_PENDING[key];
  const r = ev.result || {};
  if (r.needs_confirm) REVIEW_CONFIRM[key] = { message: r.message, text };
  else if (r.message && !(r.made || []).length && !r.switch) fail("고칠 점", new Error(r.message));
  delete REVIEW_VIEW[key];               // 새 회차를 먼저 보여 준다
  if (current === name) showMonster(name);
}

/* ---------- 오류를 화면에 보이게 ----------
   조용히 실패하면 "읽는 중…" 에서 멈춰 빈 화면으로 보인다. 원인이 무엇이든 눈에 띄어야 고칠 수 있다. */

function fail(where, err) {
  console.error(where, err);
  let bar = document.getElementById("errbar");
  if (!bar) {
    bar = el("div", "errbar");
    bar.id = "errbar";
    document.body.prepend(bar);
  }
  bar.textContent = `${where} 실패 — ${err && err.message ? err.message : err}`;
  const list = document.getElementById("monsters");
  if (list && list.querySelector(".loading")) list.replaceChildren(el("li", "loading", "불러오지 못했습니다"));
}

window.addEventListener("error", (e) => fail("스크립트", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => fail("요청", e.reason));

async function getJSON(path) {
  // 정적 사본: /api/monster/Slime → data/monster/Slime.json (export_static.py 가 같은 규칙으로 쓴다)
  if (STATIC) path = "data" + path.replace(/^\/api/, "") + ".json";
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

/* ---------- 주문 → 축 분해 ----------
   Claude Code 를 헤드리스로 부른다 (API 키 없음, 구독 자격 사용).
   분해에 10초 안팎이 걸리므로 그동안 무엇을 하고 있는지가 화면에 보여야 한다. */

const AXIS_ORDER = [
  ["motif", "모티프", "AI 가 그릴 대상"],
  ["skeleton", "골격", "리그 파츠 구성"],
  ["movement", "이동", "걷기 · 아이들 동작"],
  ["engage", "교전", "공격 동작"]
];

// 눌러서 바꿀 수 있는 축과 그 값. 사람이 "아니 그거 말고" 라고 말할 자리가 화면에 있어야 한다.
const AXIS_CHOICES = {
  skeleton: [["single", "단일덩어리"], ["articulated", "다관절"]],
  movement: [["ground", "지면 보행"], ["float", "부유"]],
  engage: [["melee", "근거리"], ["ranged", "원거리"]]
};

let ORDER = null;        // 지금 화면에 떠 있는 제안 — 고쳐 쓰기의 바탕이 된다

/* 만들기 시작한 뒤에는 고를 것이 없다 — 무엇으로 정해졌는지만 한 줄로 보여준다.
   편집 칸을 그대로 두면 "아직 바꿀 수 있나?" 로 읽히고, 실제로 바꿔도 이미 돌아가는 작업에는 반영되지 않는다. */
function renderLockedAxes(r) {
  ORDER = r;
  const box = document.getElementById("axes");
  box.hidden = false;
  box.replaceChildren();

  const head = el("div", "axes-head");
  head.appendChild(el("b", null, "이렇게 만드는 중입니다"));
  box.appendChild(head);

  const row = el("div", "axes-fixed");
  const name = el("span", "fixed-motif", r.motif);
  row.appendChild(name);
  for (const key of ["skeleton", "movement", "engage"]) {
    row.appendChild(el("span", "fixed-chip", r.labels[key]));
  }
  if (r.engage === "ranged" && r.projectile) row.appendChild(el("span", "fixed-chip", `${r.projectile} 던지기`));
  box.appendChild(row);
  // 만드는 중에도 **무엇을 주문했는지**는 보여야 한다 — 결과를 볼 때 기준이 된다
  const said = renderSaid(r);
  if (said) box.appendChild(said);
  // 선택지 · 시안 카드가 들어갈 자리는 그대로 둔다 (잠긴 채로 보인다)
  box.appendChild(renderReadiness(r));
}

function renderAxes(r) {
  ORDER = r;
  if (r.locked) { renderLockedAxes(r); return; }
  const box = document.getElementById("axes");
  box.hidden = false;
  box.replaceChildren();

  // 결정이 아니라 제안이다 — 사람이 고칠 수 있다는 것을 제목부터 말한다
  const head = el("div", "axes-head");
  head.appendChild(el("b", null, "이렇게 만들까요?"));
  head.appendChild(el("span", "axes-hint",
    r.fixedNote ? "이미 있는 계열이라 골격 · 이동 · 교전은 그 계열 값으로 고정됩니다"
                : "마음에 안 드시면 바꾸실 수 있습니다"));
  box.appendChild(head);

  // 시안을 만든 뒤에는 이력이 **몬스터 화면**에 붙박이로 있다 — 여기 또 두면 두 벌이다
  const said = r.madeIn ? null : renderSaid(r);
  if (said) box.appendChild(said);

  const locked = !!r.fixedNote;
  const grid = el("div", "axes-grid");

  // 모티프 — 글자라서 고르는 게 아니라 고쳐 쓰는 칸이다
  {
    const a = el("div", "axis");
    a.appendChild(el("div", "k", "모티프"));
    const input = el("input", "field motif-input");
    input.value = r.motif;
    input.spellcheck = false;
    input.addEventListener("change", () => {
      const v = input.value.trim();
      if (v && v !== r.motif) { r.motif = v; r.reason = "사람이 직접 고쳤다"; reproposeLocal(r); }
    });
    a.appendChild(input);
    grid.appendChild(a);
  }

  // 나머지 셋 — **두 선택지를 다 보여준다.** 숨겨 놓고 순환시키면 누를 수 있다는 걸 알 수 없다
  for (const [key, label] of AXIS_ORDER.slice(1)) {
    const a = el("div", "axis");
    a.appendChild(el("div", "k", label));
    const seg = el("div", "seg" + (locked ? " locked" : ""));
    for (const [val, name] of AXIS_CHOICES[key]) {
      const b = el("button", "seg-btn", name);
      b.setAttribute("aria-pressed", String(r[key] === val));
      b.disabled = locked;
      b.addEventListener("click", () => {
        if (r[key] === val) return;
        r[key] = val;
        r.labels = { ...r.labels, [key]: name };
        if (key === "engage") r.projectile = val === "ranged" ? (r.projectile || "투사체") : null;
        r.reason = "사람이 직접 고쳤다";
        reproposeLocal(r);
      });
      seg.appendChild(b);
    }
    a.appendChild(seg);
    if (key === "engage" && r.engage === "ranged") {
      const p = el("div", "proj");
      p.appendChild(document.createTextNode("던지는 것 "));
      const pi = el("input", "field proj-input");
      pi.value = r.projectile || "";
      pi.placeholder = "예) 책";
      pi.addEventListener("change", () => { r.projectile = pi.value.trim() || null; });
      p.appendChild(pi);
      a.appendChild(p);
    }
    grid.appendChild(a);
  }
  box.appendChild(grid);

  // 어떤 동작 프리셋이 선택됐는지 — 이게 "축 → 제작" 으로 이어지는 연결이다
  const preset = [r.labels.movement, r.skeleton === "single" ? "한 덩어리" : "관절 구동",
                  r.engage === "ranged" ? "던지기" : "돌진"].join(" · ");
  // 여기부터는 **읽는 곳**이다 — 고치는 곳(위 카드)과 섞이지 않게 선으로 가른다
  const info = el("div", "axes-info");
  const note = el("div", "axis-note");
  note.textContent = r.fixedNote
    ? `${r.fixedNote} — 아이들 · 걷기 · 공격 · 피격 · 죽음 · 전투대기 6동작이 그대로 쓰입니다`
    : `선택된 동작 프리셋: ${preset} — 아이들 · 걷기 · 공격 · 피격 · 죽음 · 전투대기 6동작을 이 기준으로 변환합니다`;
  info.appendChild(note);
  box.appendChild(info);

  if (r.reason) {
    const why = el("div", "axis-reason");
    why.appendChild(el("b", null, "판단 근거 "));
    why.appendChild(document.createTextNode(r.reason));
    info.appendChild(why);
  }

  if (!r.fixedNote) box.appendChild(renderRefine(r));
  box.appendChild(renderReadiness(r));
}

/* 사람이 직접 고쳤을 때 — Claude 를 다시 부르지 않는다. 화면은 즉시 바뀌고,
   대상 · 준비 상태만 서버에 다시 물어본다 (모티프가 바뀌면 만들 수 있는 것도 바뀐다). */
async function reproposeLocal(r) {
  renderAxes(r);
  try {
    const info = await getJSON("/api/resolve/" + encodeURIComponent(r.motif));
    r.target = info.target;
    r.readiness = info.readiness;
    if (info.fixed) { Object.assign(r, info.fixed); r.labels = info.labels; r.fixedNote = info.note; }
    else { delete r.fixedNote; }
    renderAxes(r);
  } catch (e) {
    console.error("대상 다시 보기 실패", e);   // 축 수정 자체는 이미 화면에 반영됐다
  }
}

/* 고치기가 실패하면 **쓴 글을 돌려준다.** 없어지면 처음부터 다시 타이핑해야 한다.
   화면은 고치기 전 상태로 되돌리고, 오류는 덧붙인다 (갈아엎지 않는다). */
function failRefine(r, text, msg) {
  renderAxes(r);
  const input = document.querySelector(".refine-row .field");
  if (input) { input.value = text; input.focus(); }
  axesError("고치지 못했습니다 — " + msg);
}

/* 지금까지 말한 것 — **읽기만 하는 자리**다.

   덧붙여 말하면 화면이 다시 그려지면서 입력칸이 비워진다. 그러면 *내가 뭐라고 했더라* 를
   알 길이 없다 (2026-09-21 사용자). 축 넷은 해석 결과일 뿐 원문이 아니므로,
   말한 문장 자체를 그대로 쌓아 보여준다. 이 문장들은 시안 지시문에도 그대로 들어간다. */
function renderSaid(r, pending) {
  const said = r.said || [];
  if (!said.length && !pending) return null;
  const box = el("div", "said");
  box.appendChild(el("div", "said-k", "지금까지 말한 것"));
  const ul = el("ul", "said-list");
  said.forEach((line, i) => {
    const li = el("li");
    li.appendChild(el("span", "said-n", i === 0 ? "주문" : `덧붙임 ${i}`));
    li.appendChild(document.createTextNode(line));
    ul.appendChild(li);
  });
  // 고치는 동안에도 **방금 무엇을 요청했는지**는 보여야 한다. 기다리는 쪽이 제일 궁금한 것이다
  if (pending) {
    const li = el("li", "said-wait");
    li.appendChild(el("span", "said-n", "요청 중"));
    li.appendChild(document.createTextNode(pending));
    ul.appendChild(li);
  }
  box.appendChild(ul);
  return box;
}

/* 덧붙여 말하기 — "아니 그거 말고" 를 할 자리.
   앞의 결정을 함께 보내서 가리킨 축만 바뀌게 한다. 매번 처음부터 해석하면 대화가 되지 않는다. */
function renderRefine(r) {
  const wrap = el("div", "refine");
  const row = el("div", "refine-row");
  const input = el("textarea", "field grow");
  input.rows = 2;
  input.placeholder = "덧붙여 말하기 — 예) 다리 4개로 걸어다니게 해줘 / 책을 던지는 원거리로  (Ctrl+Enter 로 보내기)";
  const go = el("button", "btn2", "고치기");

  const send = async () => {
    const more = input.value.trim();
    if (!more) { input.focus(); return; }
    go.disabled = input.disabled = true;
    const started = Date.now();
    const box = document.getElementById("axes");
    // 고치는 동안 화면을 통째로 갈아엎지 않는다 — 방금 요청한 문장이 같이 사라져서
    //  "내가 뭐라고 했더라" 가 된다 (2026-09-21 사용자). 요청한 말을 먼저 세워 두고 기다린다
    box.replaceChildren(renderSaid(r, more));
    const line = el("div", "axis-reason busy");
    line.appendChild(el("span", "spin"));
    line.appendChild(document.createTextNode("AI 가 고치는 중… 0.0초"));
    box.appendChild(line);
    // **글자만** 바꾼다 — 요소를 새로 만들면 스피너가 매번 0 으로 되돌아가 떨린다
    const tick = setInterval(() => {
      line.lastChild.textContent = `AI 가 고치는 중… ${((Date.now() - started) / 1000).toFixed(1)}초`;
    }, 100);
    try {
      const res = await fetch("/api/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: more, previous: r })
      });
      const data = await res.json();
      clearInterval(tick);
      if (!res.ok || data.error) { failRefine(r, more, data.error || `HTTP ${res.status}`); return; }
      // 덧붙인 말이 화면에서 사라지면 무엇을 말했는지 알 수 없다 (2026-09-21 사용자)
      data.said = [...(r.said || []), more];
      renderAxes(data);
    } catch (e) {
      clearInterval(tick);
      failRefine(r, more, e.message);
    } finally {
      clearInterval(tick);
    }
  };
  go.addEventListener("click", send);
  growBox(input, send);

  row.append(input, go);
  wrap.appendChild(row);
  return wrap;
}

/* 어떻게 만들지 고르는 화면 — 설명이 아니라 **선택**이다.
   설명 상자 안에 넣으면 고를 수 있다는 걸 모른다. 그리고 "기존 슬라임" 이라고만 하면
   어떤 슬라임인지 알 수 없으므로 **기준이 되는 몸을 실제로 보여준다** (2026-09-18 사용자). */
function renderChoice(r) {
  const box = el("div", "choose" + (r.locked ? " locked" : ""));
  box.appendChild(el("div", "choose-head",
    r.locked ? `${r.motif} — 이렇게 만드는 중입니다` : `${r.motif} — 어떻게 만들까요?`));
  // 추천이 기본으로 골라져 있다 — 그게 **바꿀 수 있는 값**이라는 걸 분명히 말해야 잘못 만들지 않는다
  box.appendChild(el("p", "choose-sub", r.locked
    ? "만드는 중에는 바꿀 수 없습니다."
    : "추천을 기본으로 골라 뒀습니다. 다른 쪽을 누르면 바로 바뀝니다 — 가는 거리가 달라집니다."));

  const opts = el("div", "path-opts");
  // 이미 돌고 있으면 바꿔도 반영되지 않는다 — 고를 수 없게 막는다
  const pick = (key) => { if (r.locked) return; r.familyChoice = key; renderAxes(r); };

  // ① 계열을 물려받는 길 — 기준 몸과 같은 몸을 쓰는 종류들을 함께 보여준다
  const a = el("button", "path rec");
  a.setAttribute("aria-pressed", String(r.familyChoice === "family"));
  const at = el("div", "path-title");
  at.appendChild(document.createTextNode("기존 슬라임을 바탕으로"));
  at.appendChild(el("span", "badge", "추천"));   // 추천은 조언이다 — 회색 배지로만 말한다
  a.appendChild(at);

  const base = el("div", "path-base");
  if (r.familyBase) {
    const fig = el("figure", "base-fig");
    const img = el("img");
    img.src = url(r.familyBase);
    img.alt = "기준이 되는 슬라임 몸";
    fig.appendChild(img);
    fig.appendChild(el("figcaption", null, "이 몸"));
    base.appendChild(fig);
  }
  const fam = el("div", "base-fam");
  for (const m of (r.familyMembers || [])) {
    const f = el("figure", "base-fig sm");
    if (m.thumb) {
      const im = el("img");
      im.src = url(m.thumb);
      im.alt = m.title;
      im.loading = "lazy";
      f.appendChild(im);
    }
    f.appendChild(el("figcaption", null, m.title));
    fam.appendChild(f);
  }
  base.appendChild(fam);
  a.appendChild(base);
  // 무엇을 물려받고 무엇을 새로 만드는지는 **그 선택지 안**에 있어야 한다 — 밖에 글로 빼면 고른 뒤에야 보인다
  a.appendChild(pathList([
    ["yes", `위 ${r.familyCount}종과 같은 몸 · 동작 · 25클립을 물려받습니다`],
    ["need", "정면 시안을 새로 그립니다 — 색과 무늬만 바뀝니다"],
    ["need", "볼터치 색과 상태 기호를 정합니다"]
  ]));
  a.appendChild(el("div", "path-reach", "엔진 에셋까지 만들 수 있습니다"));
  a.addEventListener("click", () => pick("family"));
  opts.appendChild(a);

  // ② 완전히 새로 그리는 길
  const b = el("button", "path");
  b.setAttribute("aria-pressed", String(r.familyChoice === "new"));
  b.appendChild(el("div", "path-title", "완전히 새로"));
  b.appendChild(el("div", "path-base new", "형태 자유"));
  b.appendChild(pathList([
    ["need", "정면 시안을 형태부터 자유롭게 그립니다"],
    ["need", `리그와 동작을 ${r.labels.skeleton} 골격에 맞춰 준비해야 합니다`]
  ]));
  b.appendChild(el("div", "path-reach", "시안까지만 — 리그와 동작이 없습니다"));
  b.addEventListener("click", () => pick("new"));
  opts.appendChild(b);

  box.appendChild(opts);
  if (r.familyChoice) {
    box.appendChild(renderConfirm(r));
    box.appendChild(conceptSlot());
  }
  return box;
}

/* 최종 확인 — 고른 것을 한 번 모아 보여주고 여기서 실행한다.
   선택이 화면 여기저기 흩어져 있으면 무엇으로 만드는지 한눈에 안 들어온다 (2026-09-18 사용자). */
function renderConfirm(r) {
  const box = el("div", "confirm");
  const head = el("div", "confirm-head");
  head.appendChild(el("b", null, "이렇게 만듭니다"));
  head.appendChild(el("span", "badge", "실행 전 확인"));
  box.appendChild(head);

  const asFamily = r.familyChoice === "family" || !!r.target;
  const rows = el("div", "confirm-rows");
  const row = (k, v, extra) => {
    const d = el("div", "confirm-row");
    d.appendChild(el("span", "ck", k));
    const val = el("span", "cv");
    val.appendChild(document.createTextNode(v));
    if (extra) val.appendChild(el("em", null, extra));
    d.appendChild(val);
    rows.appendChild(d);
  };
  row("만들 것", r.motif);
  row("몸 · 동작", asFamily ? "기존 슬라임을 물려받습니다" : "새로 만듭니다",
      asFamily ? `${r.labels.skeleton} · ${r.labels.movement} · ${r.labels.engage}`
               : `${r.labels.skeleton} · ${r.labels.movement} · ${r.labels.engage} 기준으로 준비`);
  row("공격", r.engage === "ranged" ? `${r.projectile || "투사체"} 던지기` : "몸통박치기");
  row("어디까지", asFamily ? "25클립 + 엔진 에셋" : "정면 시안까지");
  box.appendChild(rows);

  const act = el("div", "confirm-act");
  const hasConcept = r.readiness && r.readiness.checks.find(c => c.key === "concept")?.ok;
  // 이미 돌고 있으면 누를 수 없어야 한다 — 눌리면 "이미 실행 중" 오류만 나온다
  const go = el("button", "go", r.locked ? "만드는 중…" : hasConcept ? "시안 다시 만들기" : "시안 만들기");
  go.disabled = !!r.locked;
  go.addEventListener("click", () => startConcepts(r, go));
  act.appendChild(go);
  act.appendChild(el("span", "confirm-note", r.locked
    ? "끝나면 아래에 시안이 나옵니다" : "서로 다른 3안을 동시에 그립니다 · 1~3분 걸립니다"));
  box.appendChild(act);
  return box;
}

function pathList(rows) {
  const ul = el("ul", "ready-list path-list");
  for (const [kind, text] of rows) ul.appendChild(el("li", kind, text));
  return ul;
}

/* 무엇이 준비됐고 무엇이 빠졌는지 — 누르기 전에 보여준다.
   실패를 눌러 보고 알게 되는 것과 누르기 전에 아는 것은 시연에서 전혀 다르다. */
function renderReadiness(r) {
  const box = el("div", "ready");

  // 아직 없는 종류인데 **계열 이름**이 들어 있으면 조용히 정하지 않고 묻는다 —
  // "우주 슬라임" 은 슬라임 몸을 물려받으면 끝까지 갈 수 있고, 새로 그리면 시안에서 멈춘다 (2026-09-18 사용자)
  // 계열이 있는 새 종류는 **고른 뒤에도 선택지를 그대로 둔다** — 사라지면 무엇을 골랐는지,
  // 다시 고를 수 있는지 알 수 없다. 골격 · 이동 카드와 같은 방식이다 (2026-09-18 사용자)
  if (!r.target && r.family === "slime") return renderChoice(r);

  if (!r.target) {
    // 개발 계획의 단계 번호를 화면에 내보내지 않는다 — 쓰는 사람에게 의미가 없고 미완성으로 읽힌다.
    // 대신 이 몬스터를 만들려면 무엇이 필요한지만 말한다.
    const asFamily = r.familyChoice === "family";
    box.classList.add("new");
    // **이미 시안을 만든 주문이면 여기서 또 만들게 하지 않는다.** 아래 ①시안에 시안과
    //  `시안 더 만들기` 가 다 있다. 두 곳에 두면 같은 일인데 동작이 갈린다
    //  (위는 확인 없이 바로, 아래는 물어본다) — 실제로 그랬다 (2026-09-21 사용자)
    if (r.madeIn) {
      box.appendChild(el("div", "ready-head", `${r.motif} — 시안을 만들었습니다`));
      box.appendChild(el("p", "ready-done",
        "아래 ①시안에서 고르거나 더 만드시면 됩니다. 위 주문 내용은 기록으로 남겨 둡니다."));
      const go = el("button", "btn2", "①시안 으로 가기");
      go.addEventListener("click", () => {
        const st = document.querySelector('section.stage[data-stage="concept"]');
        if (st) st.scrollIntoView({ behavior: "smooth", block: "start" });
        else showMonster(r.madeIn);
      });
      box.appendChild(go);
      return box;
    }
    const head = el("div", "ready-head");
    head.appendChild(document.createTextNode(
      asFamily ? `${r.motif} — 슬라임 계열의 새 속성` : `${r.motif} — 새로 만드는 종류`));
    // 잘못 고를 수도 있다 — 되돌아갈 길을 항상 남긴다 (2026-09-18 사용자)
    if (r.familyChoice && !r.locked) {
      const back = el("button", "btn2 tiny", "만드는 방식 바꾸기");
      back.addEventListener("click", () => { r.familyChoice = null; renderAxes(r); });
      head.appendChild(back);
    }
    box.appendChild(head);
    const ul = el("ul", "ready-list");
    if (asFamily) {
      ul.appendChild(el("li", "yes", "몸 윤곽 · 동작 · 25클립을 기존 슬라임에서 물려받습니다"));
      ul.appendChild(el("li", "need", "정면 시안을 새로 그립니다 — 색과 무늬만 바뀝니다"));
      ul.appendChild(el("li", "need", "볼터치 색과 상태 기호를 정합니다"));
    } else {
      ul.appendChild(el("li", "need", "정면 시안을 새로 그립니다 — 기존 종류의 그림을 물려받을 수 없습니다"));
      ul.appendChild(el("li", "need", `리그와 동작을 ${r.labels.skeleton} 골격에 맞춰 준비합니다`));
    }
    box.appendChild(ul);
    box.appendChild(conceptAct(r));
    box.appendChild(conceptSlot());
    return box;
  }

  const rd = r.readiness;
  // 고른 경로가 여기서 끝나는 것은 **실패가 아니라 제약**이다 — 호박색으로 말한다 (PLAN:demo-ui-rules §3.1)
  box.classList.add(rd.runnable ? "ok" : rd.limited ? "limit" : "no");
  // 무엇이 남았는지는 **서버가 정한다** — 화면이 "실행 가능" 하나로 뭉뚱그리면 엔진만 남은 것과
  //  아무것도 안 만든 것이 같은 말이 된다 (2026-09-22 사용자)
  box.appendChild(el("div", "ready-head",
    rd.limited ? `${rd.title} — 시안까지 만드는 종류입니다`
      : rd.headline ? rd.headline
        : rd.runnable ? `${rd.title} — 지금 실행할 수 있습니다`
          : `${rd.title} — 지금 실행할 수 없습니다`));

  const ul = el("ul", "ready-list");
  for (const c of rd.checks) {
    const li = el("li", c.ok ? "yes" : c.limit ? "limit" : c.optional ? "opt" : "no");
    li.appendChild(el("b", null, c.label));
    li.appendChild(document.createTextNode("  " + c.note));
    ul.appendChild(li);
  }
  box.appendChild(ul);
  if (rd.limited) {
    // 「안 된다」는 **무엇이 없어서 못 하는지**로 말한다. 남의 얘기처럼 쓰면 고장으로 읽힌다
    box.appendChild(el("p", "ready-limit-note", rd.limitNote
      || "다음 단계로 가려면 이 몬스터의 리그(뼈대)와 동작이 있어야 합니다. "
      + "지금 도구는 그 둘을 슬라임 계열에서 물려받는 방식뿐이라, 새 형태는 여기서 멈춥니다. "
      + "새 형태의 리그와 동작을 만드는 기능은 아직 없습니다 — 그래서 누를 버튼도 두지 않았습니다."));
  }

  const act = el("div", "ready-act");
  const busy = !!r.locked;                 // 이미 돌고 있으면 무엇도 새로 시작할 수 없다
  // 경로가 여기서 끝나는 종류에는 `생성 시작` 을 두지 않는다 — 없는 길을 잠긴 버튼으로 보여줄 이유가 없다
  if (!rd.limited && !rd.done) {
    // **무엇이 일어날지 라벨이 그대로 말한다.** 남은 것이 엔진뿐이면 라벨도 엔진이라고 말해야
    //  누르기 전에 안다 (PLAN:demo-ui-rules §3.11)
    const label = rd.actionLabel || (rd.general ? "이어서 만들기" : "생성 시작");
    const go = el("button", "go", busy ? "만드는 중…" : rd.runnable ? label : "실행 불가");
    go.disabled = busy || !rd.runnable;
    go.addEventListener("click", () => startRun(rd.monster));
    act.appendChild(go);
    if (rd.actionHint && !busy) act.appendChild(el("span", "ready-hint", rd.actionHint));
  }

  // 막고 있는 게 "툴에서 정할 수 있는 것" 이면 여기서 정하게 한다 — 코드를 열러 가지 않도록
  const decidable = rd.checks.find(c => c.decidable);
  if (decidable) {
    const btn = el("button", "btn2", `${decidable.label} 정하기`);
    btn.disabled = busy;
    btn.addEventListener("click", () => openDecide(rd.monster, btn));
    act.appendChild(btn);
  }
  // 시안을 다시 뽑는 길은 **①시안 단계가 맡는다** (`시안 더 만들기`).
  //  거기 시안이 있는데 여기에도 두면 같은 일이 두 곳이 된다 (2026-09-21 사용자).
  //  시안이 아예 없는 종류에서만 여기가 시작점이 된다
  const stConcept = MON && MON.stages.find(s => s.key === "concept");
  if (!stConcept || !stConcept.pick) {
    const again = el("button", "btn2", rd.checks.find(c => c.key === "concept")?.ok ? "시안 다시 뽑기" : "시안 만들기");
    again.disabled = busy;
    // 주문 화면에서는 `r` 이 주문 전체다. 갤러리에서는 이름밖에 없으므로 **저장해 둔 주문**을 쓴다
    again.addEventListener("click", () => {
      if (r.labels) return startConcepts(r, again);
      openRegen(act, (stConcept && stConcept.order) || null);
    });
    act.appendChild(again);
  }

  // 일반 경로는 위에서 이미 무엇을 도는지 말했다 — 두 줄이 되지 않게 한다
  if (rd.runnable && !rd.general) {
    act.appendChild(el("span", "ready-hint", "시안 이후 전 과정을 순서대로 돌립니다 · 수 분 걸립니다"));
  }
  if (act.childElementCount) box.appendChild(act);   // 빈 줄을 남기지 않는다

  const slot = el("div", "decide-slot");
  slot.id = "decideSlot";
  box.appendChild(slot);
  box.appendChild(conceptSlot());
  return box;
}

/* ---------- 시안 ----------
   한 장만 뽑으면 고를 것이 없다. Claude 가 서로 다른 해석 3안을 만들고 Codex 를 셋 동시에 띄운다 —
   각자 끝나는 대로 카드가 채워지므로 기다리는 동안에도 화면이 죽지 않는다. */

/* 시안 생성이 끝났다 — 위쪽 실행 패널을 비우고 **그 종류의 단계 화면**으로 넘긴다.

   위(만드는 과정)와 아래(그 종류의 산출물)가 같은 시안을 둘 다 들고 있으면
   확정 버튼이 두 개가 되고 "어느 쪽을 봐야 하지" 가 된다 (2026-09-21 사용자).
   같은 폴더로 두 번 오지 않게 막는다 — 새로고침이면 같은 상태가 다시 배달된다. */
let CONCEPT_DONE = null;
let CONCEPT_RUNNING = false;   // 시안을 그리는 중인가 — 주문 화면을 남겨 둘지 가른다

function finishConcepts(folder) {
  LAST_CONCEPTS = null;
  document.getElementById("conceptSlot")?.replaceChildren();
  if (CONCEPT_DONE === folder) return;
  CONCEPT_DONE = folder;
  // 이 주문으로 이미 시안을 만들었다 — 위 패널은 만들기를 그만두고 기록만 남긴다
  if (ORDER) { ORDER.madeIn = folder; renderAxes(ORDER); }
  showMonster(folder);
}

function conceptSlot() {
  const s = el("div", "concept-slot");
  s.id = "conceptSlot";
  return s;
}

function conceptAct(r) {
  const act = el("div", "ready-act");
  const b = el("button", "go", "시안 만들기");
  b.addEventListener("click", () => startConcepts(r, b));
  act.appendChild(b);
  act.appendChild(el("span", "ready-hint", "서로 다른 3안을 동시에 그립니다 · 1~3분 걸립니다"));
  return act;
}

async function startConcepts(r, btn) {
  btn.disabled = true;
  try {
    const res = await fetch("/api/concepts/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      // 참조 사진은 **어느 경로로 시작하든** 같이 간다 — 한 곳에서 붙여야 빠지는 자리가 없다.
      //  화면에 올린 사진이 있으면 그것을, 없으면 그 종류가 전에 쓰던 사진을 그대로 쓴다
      body: JSON.stringify({ parsed: { ...r, refs: REFS.length ? REFS.map(x => x.path) : (r.refs || []) } })
    });
    const data = await res.json();
    if (!res.ok || data.error) { axesError(data.error || `HTTP ${res.status}`); btn.disabled = false; return; }
    r.locked = true;          // 시작했으면 위쪽은 더 고를 게 없다
    CONCEPT_DONE = null;      // 새 실행이다 — 끝나면 다시 그 종류로 데려간다
    renderAxes(r);
    applyConcepts(data);
    // 진행과 오류는 **위쪽 패널**에 뜬다. 아래 단계에서 눌렀으면 거기까지 데려가야
    //  "눌렀는데 아무 일도 안 일어난다" 가 되지 않는다 (2026-09-21 사용자)
    CONCEPT_RUNNING = true;
    showOrder(true);
    document.getElementById("order").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    axesError("실패 — " + e.message);
    btn.disabled = false;
  }
}

/* 시안 카드가 들어갈 자리. 새로고침 뒤에는 주문 화면이 없으므로 **서버가 준 정보만으로 다시 세운다** —
   작업은 서버에서 계속 돌고 있는데 화면만 비어 있으면 진행 상황을 잃는다 (2026-09-18 사용자). */
function conceptHost(st) {
  const found = document.getElementById("conceptSlot");
  if (found) return found;
  const box = document.getElementById("axes");
  box.hidden = false;
  const head = el("div", "axes-head");
  head.appendChild(el("b", null, st.motif ? `${st.motif}` : "만드는 중"));
  head.appendChild(el("span", "badge run", "이어서 보는 중"));
  box.replaceChildren(head);
  const slot = conceptSlot();
  box.appendChild(slot);
  const input = document.getElementById("orderText");
  if (input && !input.value && st.motif) input.value = st.motif;
  return slot;
}

function applyConcepts(st) {
  LAST_CONCEPTS = st;
  const slot = conceptHost(st);
  slot.replaceChildren();

  const head = el("div", "decide-head");
  const label = { running: "시안을 그리는 중", done: "시안이 나왔습니다 — 하나를 고르세요",
                  failed: "시안 생성 실패", stopped: "중단됨" }[st.status] || st.status;
  if (st.status === "running") head.appendChild(el("span", "spin"));
  head.appendChild(el("b", null, label));
  head.appendChild(el("span", "decide-sub", `${st.elapsed}초 경과`));
  slot.appendChild(head);
  if (st.error) slot.appendChild(el("div", "axis-err", st.error));

  if (!st.slots || !st.slots.length) {
    slot.appendChild(el("div", "axis-reason", "해석안을 만드는 중…"));
    return;
  }

  // 서버가 기억하는 확정본이 있으면 그것을 따른다 — 새로고침해도 무엇을 확정했는지 남는다
  if (typeof st.picked === "number") CONCEPT_FIXED = st.picked;
  const locked = CONCEPT_FIXED !== null;
  if (locked) CONCEPT_SEL = CONCEPT_FIXED;

  const grid = el("div", "concepts" + (locked ? " locked" : ""));
  st.slots.forEach((s, i) => {
    const usable = s.status === "ok" && !(s.check && !s.check.ok);
    const card = el("div", "concept" + (s.status === "ok" ? " ready" : ""));
    if (usable) {
      card.setAttribute("role", "button");
      card.setAttribute("aria-pressed", String(CONCEPT_SEL === i));
      // 확정 전에는 몇 번이고 바꿀 수 있다 — 카드를 눌러 고른다
      // 카드는 버튼이 아니라 `:disabled` 가 안 걸린다 — 실행 중에는 손으로 막는다
      if (!locked) card.addEventListener("click", () => {
        if (BUSY) return;
        CONCEPT_SEL = i;
        applyConcepts(st);
      });
    }
    const box = el("div", "concept-img");
    if (s.path) {
      const img = el("img");
      img.src = url(s.path) + "?t=" + Date.now();   // 같은 이름으로 다시 그릴 수 있다
      img.alt = s.label;
      box.appendChild(img);
    } else {
      const ph = el("div", "concept-wait");
      if (s.status === "run") ph.appendChild(el("span", "spin"));
      ph.appendChild(document.createTextNode(
        s.status === "fail" ? (s.note || "실패") : s.status === "run" ? "그리는 중…" : "대기"));
      box.appendChild(ph);
    }
    card.appendChild(box);

    const lab = el("div", "concept-label");
    lab.appendChild(document.createTextNode(s.label));
    // 규격 검사 결과 — 어긋난 시안을 고르면 4방향 몸부터 깨진다. 고르기 전에 보여준다
    if (s.check) lab.appendChild(el("span", s.check.ok ? "badge ok" : "badge err",
      s.check.ok ? "규격 맞음" : "규격 어긋남"));
    card.appendChild(lab);
    card.appendChild(el("div", "concept-look", s.look || ""));
    if (s.check && !s.check.ok) card.appendChild(el("div", "concept-bad", s.check.note));

    grid.appendChild(card);
  });
  slot.appendChild(grid);

  // 확정은 **선택지 밖의 버튼 하나**가 맡는다 (규칙 §3.6 최종 확인 영역).
  // 카드 안에 실행 버튼을 두면 고르는 것과 확정하는 것이 한 번의 클릭으로 붙어 되돌릴 수 없다.
  const usableCount = st.slots.filter(s => s.status === "ok" && !(s.check && !s.check.ok)).length;
  if (!usableCount) return;

  const act = el("div", "concept-act");
  if (locked) {
    act.appendChild(el("span", "ready-hint",
      `${CONCEPT_FIXED + 1}번 시안을 정면 시안으로 확정했습니다. 이모티콘 · 무늬는 이 시안 그대로 갑니다.`));
    const redo = el("button", "btn2", "다시 고르기");
    redo.addEventListener("click", () => { CONCEPT_FIXED = null; applyConcepts(st); });
    act.appendChild(redo);
  } else {
    const go = el("button", "go", "선택한 시안 확정하고 다음 단계로");
    go.disabled = CONCEPT_SEL === null;
    go.addEventListener("click", () => confirmConcept(st, go));
    act.appendChild(go);
    act.appendChild(el("span", "ready-hint", CONCEPT_SEL === null
      ? "시안을 하나 눌러 고른 뒤 진행합니다"
      : `${CONCEPT_SEL + 1}번 시안으로 다음 단계를 진행합니다 — 확정 전까지 몇 번이고 바꿀 수 있습니다`));
  }
  slot.appendChild(act);
}

/* 시안 확정을 서버에 알리는 **유일한 통로**. 주문 화면과 갤러리가 같이 쓴다 —
   둘이 따로 부르면 한쪽만 고쳤을 때 다른 쪽이 조용히 깨진다 (2026-09-21 실제로 그랬다). */
async function commitConcept(folder, index) {
  const res = await fetch("/api/concepts/pick", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, index })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function confirmConcept(st, btn) {
  const folder = st.folder, index = CONCEPT_SEL;
  btn.disabled = true;
  try {
    const data = await commitConcept(folder, index);
    // 시안이 정해지면 만들 수 있는지가 바뀐다 — 준비 판정을 다시 그린다
    if (data.readiness) {
      const box = document.querySelector(".ready");
      if (box) box.replaceWith(renderReadiness({ target: folder, motif: data.readiness.title, readiness: data.readiness }));
    }
    CONCEPT_FIXED = data.picked - 1;
    st.picked = CONCEPT_FIXED;
    // 갤러리에서 골랐으면 그 종류를 다시 읽어 "고른 것" 표시와 안내를 갱신한다.
    // **시안 카드는 맨 나중에 다시 그린다** — 앞의 두 갱신이 빈 자리를 새로 만들기 때문이다
    if (current === folder) await showMonster(folder);
    // **선택지를 치우지 않는다** — 카드는 그대로 두고 확정 표시만 올린다 (2026-09-18 사용자)
    applyConcepts(st);
  } catch (e) {
    axesError("실패 — " + e.message);
    btn.disabled = false;
  }
}

/* ---------- 정하기 ----------
   빈 칸을 주고 채우라고 하면 사람이 시안을 열어 스포이드로 색을 찍어야 한다.
   시안을 먼저 재고 Claude 가 근거 있는 선택지를 만든다 — 사람은 고르기만 한다. */

const PICKED = {};

function swatch(rgb) {
  const s = el("span", "swatch");
  s.style.background = `rgb(${rgb.join(",")})`;
  return s;
}

function markImg(name, rgb, body) {
  const img = el("img", "markimg");
  img.src = `/api/mark?name=${encodeURIComponent(name)}&rgb=${rgb.join(",")}&body=${body.join(",")}`;
  img.alt = name;
  return img;
}

function renderDecide(data) {
  const slot = document.getElementById("decideSlot");
  slot.replaceChildren();
  const body = data.measure.bodyMean;

  const head = el("div", "decide-head");
  head.appendChild(el("b", null, `${data.title} — 정할 것 ${data.questions.length}가지`));
  head.appendChild(el("span", "decide-sub",
    `시안 측정: 몸 rgb(${body.join(",")}) · 밝기 평균 ${data.measure.lumMean} · 밝은쪽 ${data.measure.lumBright}`));
  slot.appendChild(head);

  for (const q of data.questions) {
    PICKED[q.key] = q.options[0].value;         // 첫 번째가 추천 — 기본으로 골라 둔다
    const wrap = el("div", "q");
    const t = el("div", "q-title");
    t.appendChild(el("b", null, q.label));
    if (q.why) t.appendChild(el("span", "q-why", q.why));
    wrap.appendChild(t);

    const opts = el("div", "q-opts");
    for (const o of q.options) {
      const b = el("button", "opt");
      b.setAttribute("aria-pressed", String(o.value === q.options[0].value));
      const top = el("div", "opt-top");
      if (q.key === "mark") top.appendChild(markImg(o.value, [90, 70, 40], body));
      else if (Array.isArray(o.value)) top.appendChild(swatch(o.value));
      top.appendChild(el("span", "opt-label", o.label));
      b.appendChild(top);
      if (o.why) b.appendChild(el("div", "opt-why", o.why));
      b.addEventListener("click", () => {
        PICKED[q.key] = o.value;
        [...opts.children].forEach(c => c.setAttribute("aria-pressed", String(c === b)));
        refreshMarkPreview(body);
      });
      opts.appendChild(b);
    }
    wrap.appendChild(opts);
    slot.appendChild(wrap);
  }

  const prev = el("div", "decide-prev");
  prev.id = "decidePrev";
  slot.appendChild(prev);
  refreshMarkPreview(body);

  const act = el("div", "ready-act");
  const save = el("button", "go", "이 값으로 정하기");
  save.addEventListener("click", () => saveDecide(data.monster, save));
  act.appendChild(save);
  act.appendChild(el("span", "ready-hint", "저장하면 파이프라인이 다음 실행에서 이 값을 사용합니다"));
  slot.appendChild(act);
}

function refreshMarkPreview(body) {
  const box = document.getElementById("decidePrev");
  if (!box || !PICKED.mark || !PICKED.mark_rgb) return;
  box.replaceChildren();
  box.appendChild(el("span", "decide-sub", "고른 조합 미리보기 — 기호는 몸 색 위에서 이렇게 보입니다"));
  box.appendChild(markImg(PICKED.mark, PICKED.mark_rgb, body));
  if (PICKED.cheek_rgb) {
    const c = el("span", "prev-cheek");
    c.appendChild(swatch(PICKED.cheek_rgb));
    c.appendChild(document.createTextNode(" 볼터치"));
    box.appendChild(c);
  }
}

async function openDecide(monster, btn) {
  const slot = document.getElementById("decideSlot");
  btn.disabled = true;
  const started = Date.now();
  const tick = setInterval(() => busyLine(slot,
    `시안 색을 재고 AI 가 선택지를 만드는 중… ${((Date.now() - started) / 1000).toFixed(1)}초`), 100);
  try {
    const res = await fetch("/api/decide/" + encodeURIComponent(monster));
    const data = await res.json();
    clearInterval(tick);
    if (!res.ok || data.error) { slot.replaceChildren(el("div", "axis-err", data.error || `HTTP ${res.status}`)); return; }
    renderDecide(data);
  } catch (e) {
    clearInterval(tick);
    slot.replaceChildren(el("div", "axis-err", "실패 — " + e.message));
  } finally {
    clearInterval(tick);
    btn.disabled = false;
  }
}

async function saveDecide(monster, btn) {
  btn.disabled = true;
  try {
    const res = await fetch("/api/decide/" + encodeURIComponent(monster), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: PICKED, pattern: null })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      document.getElementById("decideSlot").appendChild(el("div", "axis-err", data.error || `HTTP ${res.status}`));
      return;
    }
    // 저장했으면 준비 판정이 바뀐다 — 다시 그려서 생성 시작이 열리게 한다
    const rd = await getJSON("/api/ready/" + encodeURIComponent(monster));
    const box = document.querySelector(".ready");
    if (box) box.replaceWith(renderReadiness({ target: monster, motif: rd.title, readiness: rd }));
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 실행 ---------- */

let RUN = null;
// 지금 서버에서 뭔가 돌고 있나 — **잠금 판단의 유일한 근거**다.
//  자리마다 따로 판단하면 새 버튼을 만들 때마다 빠진다 (2026-09-21 사용자: 실제로 `시안 만들기` 가 빠졌다)
let BUSY = false;
let LAST_CONCEPTS = null;      // 다시 그릴 때 시안 카드를 되살리려고 들고 있는다
// 시안은 **고르는 것과 확정하는 것이 다른 행동**이다. 고르기는 되돌릴 수 있고, 확정해야 다음 단계로 간다.
let CONCEPT_SEL = null;        // 지금 고른 시안 (0-based) — 아직 확정 전
let CONCEPT_FIXED = null;      // 확정한 시안 (0-based)
let runTick = null;        // 경과 시간은 브라우저가 센다 — 한 단계가 길면 서버 이벤트가 오래 안 온다
let runBase = 0;
const stageEls = new Map();

async function startRun(monster) {
  const res = await fetch("/api/run/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monster })
  });
  const data = await res.json();
  if (!res.ok || data.error) { axesError(data.error || `HTTP ${res.status}`); return; }
  if (ORDER) { ORDER.locked = true; renderAxes(ORDER); }   // 파이프라인이 돌기 시작하면 위쪽을 잠근다
  if (current !== monster) await showMonster(monster);
  applyRun(data);
}

async function stopRun() {
  await fetch("/api/run/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

function runBanner() {
  let b = document.getElementById("runbar");
  if (!b) {
    b = el("div", "runbar");
    b.id = "runbar";
    document.getElementById("main").prepend(b);
  }
  return b;
}

/* 돌고 있는 동안 눌러서는 안 되는 것을 **한 곳에서 한꺼번에** 잠근다 (PLAN:demo-ui-rules §3.10).

   잠그는 것은 **일을 일으키는 버튼**뿐이다 — 종류 목록 · 크게 보기 · 배경 토글처럼
   보기만 하는 것은 실행 중에도 살아 있어야 한다. 멈추는 버튼도 마찬가지라 `keep-live` 로 뺀다.

   `busyLock` 표시를 남기는 이유 — 다른 이유로 이미 잠겨 있던 버튼(고른 것이 없어서 잠긴 `확정` 등)을
   실행이 끝났다고 멋대로 풀면 안 된다. **내가 잠근 것만 내가 푼다.** */
const BUSY_LOCK = ".go, .btn2, .seg-btn, .path, .opt";

function applyBusy() {
  document.querySelectorAll(BUSY_LOCK).forEach(b => {
    if (b.classList.contains("keep-live")) return;
    if (BUSY) {
      if (!b.disabled) { b.disabled = true; b.dataset.busyLock = "1"; }
    } else if (b.dataset.busyLock === "1") {
      b.disabled = false;
      delete b.dataset.busyLock;
    }
  });
  document.body.classList.toggle("busy", BUSY);
}

function setBusy(on) {
  BUSY = !!on;
  applyBusy();
}

/* 화면이 다시 그려지면 **새로 만들어진 버튼**도 잠겨야 한다.
   렌더 함수마다 호출을 끼워 넣으면 또 빠지는 자리가 생기므로, 붙는 것을 보고 건다. */
function watchBusy() {
  new MutationObserver(() => { if (BUSY) applyBusy(); })
    .observe(document.body, { childList: true, subtree: true });
}

function applyRun(state) {
  RUN = state;
  setBusy(state.status === "running");
  const b = runBanner();
  b.replaceChildren();
  b.className = "runbar " + state.status;

  const label = { running: "실행 중", done: "완료", failed: "실패", stopped: "중단됨" }[state.status] || state.status;
  const head = el("div", "runbar-head");
  if (state.status === "running") head.appendChild(el("span", "spin"));
  head.appendChild(el("b", null, `${label}`));
  const sub = el("span", "runbar-sub");
  const paint = (secs) =>
    sub.textContent = `${state.monster}  ·  ${secs.toFixed(1)}초 경과  ·  ${state.stage ? (state.stageLabel || state.stage) + " 단계" : "—"}`;
  paint(state.elapsed);
  head.appendChild(sub);

  clearInterval(runTick);
  if (state.status === "running") {
    // 한 단계가 수십 초 걸리는 동안 서버 이벤트가 없다. 멈춘 화면으로 보이지 않게 여기서 센다.
    runBase = Date.now() - state.elapsed * 1000;
    runTick = setInterval(() => paint((Date.now() - runBase) / 1000), 100);
    const stop = el("button", "btn2 keep-live", "중단");   // 멈추는 버튼까지 잠그면 멈출 수가 없다
    stop.addEventListener("click", stopRun);
    head.appendChild(stop);
  }
  b.appendChild(head);
  if (state.error) b.appendChild(el("div", "runbar-err", state.error));

  for (const [key, st] of Object.entries(state.stages || {})) {
    const sec = stageEls.get(key);
    if (!sec) continue;
    sec.dataset.run = st;
    // 실행 중에는 배지도 상태를 따라간다 — 번호 테두리만으로는 멀리서 안 보인다
    const stat = sec.querySelector('[data-role="stat"]');
    if (!stat) continue;
    // **산출물이 있는 단계에 「실패」를 덮어쓰지 않는다.** 좀비 파츠가 실제로는 나와
    //  그 칸에 9개가 쌓여 있는데 배지만 「실패」여서, 같은 칸이 두 말을 했다
    //  (2026-09-22 사용자). 지난 실행의 결과보다 **지금 디스크에 있는 것**이 우선이다
    const made = (MON?.stages.find(s => s.key === key)?.items || []).length;
    if (st === "fail" && made) continue;
    const look = { run: ["badge run", "진행 중"], ok: ["badge ok", "완료"],
                   fail: ["badge err", "실패"], wait: ["badge", "대기"] }[st];
    if (look) { stat.className = look[0]; stat.textContent = look[1]; }
  }
}

function appendLog(stage, line, isErr) {
  const sec = stageEls.get(stage);
  if (!sec) return;
  let pre = sec.querySelector(".stage-log");
  if (!pre) {
    pre = el("pre", "stage-log");
    sec.querySelector(".stage-desc").after(pre);
  }
  const row = el("div", isErr ? "err" : null, line);
  pre.appendChild(row);
  while (pre.children.length > 12) pre.removeChild(pre.firstChild);
  pre.scrollTop = pre.scrollHeight;
}

/* 한 단계만 다시 그린다.

   시안을 고르는 것처럼 **한 단계 안에서 끝나는 변화**에 `showMonster()` 를 부르면
   화면을 통째로 비웠다가(`main.replaceChildren("불러오는 중…")`) 다시 짓는다 —
   스크롤이 맨 위로 튀고 모든 이미지가 새로 붙는다. 바뀐 자리만 바꾼다 (2026-09-21 사용자). */
async function refreshStage(key) {
  if (!MON || !current) return;
  const mon = await getJSON("/api/monster/" + encodeURIComponent(current));
  if (mon.error) throw new Error(mon.error);
  const cur = MON.stages.find(s => s.key === key);
  const next = mon.stages.find(s => s.key === key);
  const old = stageEls.get(key);
  if (!cur || !next || !old) return;
  Object.assign(cur, next);
  const fresh = renderStage(cur, MON.stages.indexOf(cur));
  if (old.dataset.run) fresh.dataset.run = old.dataset.run;
  const log = old.querySelector(".stage-log");
  if (log) fresh.querySelector(".stage-desc").after(log);
  // 「다음에 할 일」 패널은 이 단계에 얹혀 있을 수 있다 — 다시 그리면서 떨어뜨리지 않는다
  const panel = old.querySelector(".nextstep");
  if (panel) { fresh.appendChild(panel); fresh.classList.add("nexthere"); }
  old.replaceWith(fresh);
  stageEls.set(key, fresh);
}

function mergeItems(stages) {
  if (!MON) return;
  for (const s of stages) {
    const cur = MON.stages.find(x => x.key === s.key);
    if (!cur || cur.items.length === s.items.length) continue;   // 바뀐 단계만 다시 그린다
    cur.items = s.items;
    const idx = MON.stages.indexOf(cur);
    const old = stageEls.get(s.key);
    if (!old) continue;
    const fresh = renderStage(cur, idx);
    if (old.dataset.run) fresh.dataset.run = old.dataset.run;
    const log = old.querySelector(".stage-log");
    if (log) fresh.querySelector(".stage-desc").after(log);
    old.replaceWith(fresh);
    stageEls.set(s.key, fresh);
  }
}

function connectRun() {
  const es = new EventSource("/api/run/events");
  es.onmessage = (e) => {
    let ev;
    try { ev = JSON.parse(e.data); } catch { return; }
    if (ev.type === "state" && ev.kind === "concept") {
      CONCEPT_RUNNING = ev.status === "running";
      setBusy(CONCEPT_RUNNING);
      if (CONCEPT_RUNNING) showOrder(true);      // 진행 표시가 뜨는 자리를 가리지 않는다
      // **그리는 중에만** 위쪽 실행 패널이 시안을 맡는다. 끝난 것은 그 종류의 단계 화면이 맡는다 —
      //  새로고침으로 끝난 실행이 다시 배달돼도 두 벌이 되지 않게 여기서 한 번에 가른다
      if (ev.status === "running" || !ev.folder) applyConcepts(ev);
      else finishConcepts(ev.folder);
    } else if (ev.type === "state") {
      if (ev.monster && current !== ev.monster) { showMonster(ev.monster).then(() => applyRun(ev)); return; }
      applyRun(ev);
    } else if (ev.type === "log" && !ev.stage) {
      // 시안 생성 로그 — 붙일 단계가 없다. 콘솔에만 남긴다
      console.log("[시안]", ev.line);
    } else if (ev.type === "log") {
      appendLog(ev.stage, ev.line, ev.err);
    } else if (ev.type === "items") {
      mergeItems(ev.stages);
    } else if (ev.type === "end") {
      setBusy(false);
      if (ev.kind === "concept") CONCEPT_RUNNING = false;
      const b = document.getElementById("runbar");
      if (b) b.classList.add(ev.status);
      // 끝났으면 잠금을 푼다 — 안 그러면 다시 시작할 수가 없다
      if (ORDER && ORDER.locked) {
        ORDER.locked = false;
        renderAxes(ORDER);
      }
      if (ev.kind === "concept" && ev.status === "done" && ev.folder) finishConcepts(ev.folder);
      else if (LAST_CONCEPTS) applyConcepts(LAST_CONCEPTS);   // 실패 · 중단이면 무엇이 나왔었는지 남겨 둔다
      if (ev.kind !== "concept" && RUN && RUN.feedbackStem) reviewDone(ev);
    }
  };
  // onerror 는 브라우저가 알아서 재연결한다 — 서버를 재시작해도 화면이 다시 붙는다
}

/* 오류는 **덧붙인다.** 화면을 갈아엎으면 사람이 고른 것이 통째로 사라진다 (2026-09-18 사용자). */
function axesError(msg) {
  const box = document.getElementById("axes");
  box.hidden = false;
  let e = box.querySelector(".axis-err");
  if (!e) { e = el("div", "axis-err"); box.appendChild(e); }
  e.textContent = msg;
  e.scrollIntoView({ block: "nearest" });
}

/* 진행 표시는 **글자만** 갈아 끼운다.
   요소를 통째로 새로 만들면 CSS 애니메이션이 매번 0 으로 되돌아가 스피너가 돌지 못하고 떤다. */
function busyLine(box, text) {
  let line = box.querySelector(".busy");
  if (!line) {
    line = el("div", "axis-reason busy");
    line.appendChild(el("span", "spin"));
    line.appendChild(document.createTextNode(""));
    box.replaceChildren(line);
  }
  line.lastChild.textContent = text;
}

function axesBusy(text) {
  const box = document.getElementById("axes");
  box.hidden = false;
  busyLine(box, text);
}

let LAST_ORDER = null;      // 마지막으로 분석시킨 주문 문장 — "새 주문인가" 를 여기서 가른다

async function submitOrder() {
  const input = document.getElementById("orderText");
  const btn = document.getElementById("orderGo");
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  // **새 주문이면 참고 사진을 비운다** (2026-09-21 사용자). 앞 몬스터의 사진이 조용히
  //  따라붙으면 안 된다. 단 「같은 주문을 다시 분석」 은 새 주문이 아니다 — 그때 비우면
  //  방금 붙인 사진이 쓰이기도 전에 날아간다. 그래서 **문장이 달라졌을 때만** 비운다.
  if (LAST_ORDER !== null && text !== LAST_ORDER && REFS.length) {
    const n = REFS.length;
    await clearRefs();
    // 실패가 아니라 알림이다 — 빨강을 쓰지 않는다 (PLAN:demo-ui-rules §3.1)
    refsNote(`새 주문이라 앞서 올린 참고 사진 ${n}장을 뺐습니다. 필요하면 다시 올려 주세요.`);
  }
  LAST_ORDER = text;

  btn.disabled = true;
  const started = Date.now();
  const tick = setInterval(() => axesBusy(`AI 가 주문을 축으로 분해하는 중… ${((Date.now() - started) / 1000).toFixed(1)}초`), 100);
  try {
    const res = await fetch("/api/parse", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    clearInterval(tick);
    if (!res.ok || data.error) { axesError(data.error || `HTTP ${res.status}`); return; }
    data.said = [text];              // 사람이 말한 것을 그대로 들고 간다 (아래 renderSaid)
    renderAxes(data);
  } catch (e) {
    clearInterval(tick);
    axesError("요청 실패 — " + e.message);
  } finally {
    clearInterval(tick);
    btn.disabled = false;
  }
}

function initOrder() {
  document.getElementById("orderGo").addEventListener("click", submitOrder);
  growBox(document.getElementById("orderText"), submitOrder);
  initRefs();
}

/* 여러 줄 입력칸 — **쓰는 만큼 늘어난다.**
   한 줄짜리에 긴 문장을 넣으면 방금 쓴 것도 못 읽는다 (2026-09-21 사용자).
   여러 줄이 되면 Enter 는 줄바꿈이 맞으므로, 보내기는 Ctrl(⌘)+Enter 로 옮긴다. */
function growBox(box, send) {
  const fit = () => {
    box.style.height = "auto";
    box.style.height = Math.min(box.scrollHeight + 2, 260) + "px";
  };
  box.addEventListener("input", fit);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  });
  // 화면에 붙기 전에는 높이를 잴 수 없다(`scrollHeight` 가 0). 붙은 다음 한 번 더 잰다
  fit();
  requestAnimationFrame(fit);
  return box;
}

/* ---------- 참조 이미지 ----------
   "절반만 노출되고 아래는 포장지로 감싸인 지우개" 는 글로 전해지지 않는다 — 실제로 세 시안이
   전부 다른 것이 나왔다 (2026-09-21 사용자). 실물 사진을 주면 형태를 그대로 따를 수 있다.
   사진은 **해석 3안 단계부터** 쓰인다. 거기서 모티프를 벗어나면 그림은 이미 늦는다. */

let REFS = [];        // [{path, name, url}] — 서버에 저장된 참조 이미지

function initRefs() {
  const drop = document.getElementById("refsDrop");
  const input = document.getElementById("refsInput");
  input.addEventListener("change", () => { addRefs(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach(k => drop.addEventListener(k, (e) => {
    e.preventDefault();
    if (!BUSY) drop.classList.add("over");
  }));
  ["dragleave", "drop"].forEach(k => drop.addEventListener(k, (e) => {
    e.preventDefault();
    drop.classList.remove("over");
  }));
  drop.addEventListener("drop", (e) => { if (!BUSY) addRefs(e.dataTransfer.files); });
}

async function addRefs(files) {
  if (BUSY) return;                       // 돌고 있는 동안에는 바꿔도 반영되지 않는다
  for (const f of [...files]) {
    if (!f.type.startsWith("image/")) { refsError(`${f.name} 은 이미지가 아닙니다`); continue; }
    try {
      const data = await new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => no(new Error("파일을 읽지 못했습니다"));
        r.readAsDataURL(f);
      });
      const res = await fetch("/api/refs/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, data })
      });
      const out = await res.json();
      if (!res.ok || out.error) { refsError(`${f.name} — ${out.error || res.status}`); continue; }
      REFS.push({ path: out.path, name: f.name, url: data });
    } catch (e) {
      refsError(`${f.name} — ${e.message}`);
    }
  }
  renderRefs();
}

async function clearRefs() {
  const gone = REFS.splice(0);
  renderRefs();
  await Promise.all(gone.map(r => fetch("/api/refs/drop", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: r.path })
  }).catch(() => {})));
}

function refsError(msg) {
  // 오류는 **덧붙인다** — 화면을 갈아엎으면 이미 올린 사진이 사라진다
  document.getElementById("refsList").appendChild(el("div", "refs-err", msg));
}

function refsNote(msg) {
  document.getElementById("refsList").appendChild(el("div", "refs-note", msg));
}

function renderRefs() {
  const list = document.getElementById("refsList");
  list.replaceChildren();
  REFS.forEach((r, i) => {
    const card = el("div", "ref");
    const img = el("img");
    img.src = r.url;
    img.alt = r.name;
    card.appendChild(img);
    const x = el("button", "ref-x keep-live", "✕");   // 올린 것을 무르는 길은 늘 열어 둔다
    x.title = "이 사진 빼기";
    x.addEventListener("click", async () => {
      const gone = REFS.splice(i, 1)[0];
      renderRefs();
      await fetch("/api/refs/drop", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: gone.path })
      }).catch(() => {});
    });
    card.appendChild(x);
    list.appendChild(card);
  });
  document.getElementById("refs").classList.toggle("has", REFS.length > 0);
}

/* ---------- 만드는 과정 (기본 화면) ----------
   처음 열었을 때 이전에 만든 결과물을 띄우면, 만들러 온 사람이 남의 완성품을 먼저 보게 된다.
   대신 **앞으로 거칠 과정**을 비워 둔 채 보여준다 — 생성을 시작하면 같은 자리가 채워지므로
   빈 화면이 그대로 설명이 된다. */

/* `새로 만들기` 는 **새 주문**이다 — 앞 몬스터의 흔적을 하나도 물려주지 않는다.

   스마트폰을 만든 뒤 눌렀더니 모티프 칸에 「스마트폰」, 축 넷, 판단 근거, 「시안을 만들었습니다」
   패널이 **그대로 남아 있었다** (2026-09-22 사용자). 화면이 들고 있던 상태를 아무도 비우지
   않아서다. 참고 사진은 더 위험했다 — 앞 몬스터 사진이 **조용히 새 주문에 따라붙는다.**

   그리는 중이면 비우지 않는다 — 거기에 진행 표시가 떠 있다 (PLAN:demo-ui-rules §3.8.1). */
async function resetOrder() {
  if (BUSY || CONCEPT_RUNNING) return;
  ORDER = null;
  LAST_ORDER = null;
  LAST_CONCEPTS = null;
  CONCEPT_DONE = null;
  CONCEPT_SEL = null;
  CONCEPT_FIXED = null;

  const t = document.getElementById("orderText");
  if (t) { t.value = ""; t.style.height = ""; }
  const axes = document.getElementById("axes");
  if (axes) { axes.replaceChildren(); axes.hidden = true; }
  document.getElementById("conceptSlot")?.replaceChildren();
  if (REFS.length) await clearRefs();
}

function renderOverview() {
  // 이미 이 화면에 있으면 비우지 않는다 — **쓰고 있던 주문이 날아간다.**
  //  비울 것은 「만든 것을 보다가 새로 만들러 온」 경우다
  const cameFromMonster = current !== null;
  current = null;
  MON = null;
  stageEls.clear();
  document.querySelectorAll(".mon").forEach(b => b.setAttribute("aria-current", "false"));
  document.getElementById("newBtn")?.setAttribute("aria-current", "true");
  showOrder(true);                 // 여기가 만드는 자리다
  if (cameFromMonster) resetOrder();   // 그리고 **빈 자리**여야 한다

  const main = document.getElementById("main");
  main.replaceChildren();

  const head = el("div", "mon-head");
  head.appendChild(el("h2", null, "이런 과정을 거쳐 만듭니다"));
  main.appendChild(head);
  main.appendChild(el("p", "overview-sub", STATIC
    ? "말 한 줄과 AI 시안 한 장에서 시작해 아래 단계를 거쳐 게임 엔진에 넣을 리소스가 나옵니다. 왼쪽에서 만든 것을 고르면 단계별 결과를 볼 수 있습니다."
    : "위에서 만들고 싶은 것을 적고 생성을 시작하면, 각 단계의 결과가 아래에 순서대로 쌓입니다."));

  STAGES.forEach((s, i) => {
    const sec = renderStage({ key: s.key, label: s.label, desc: s.desc, items: [] }, i);
    sec.classList.add("blank");
    // 아직 시작 전이다 — "대기" 가 아니라 "예정" 이고, 번호도 보라(진행 중)를 쓰지 않는다
    const stat = sec.querySelector('[data-role="stat"]');
    if (stat) stat.textContent = "예정";
    stageEls.set(s.key, sec);
    main.appendChild(sec);
  });
}

function renderPipelineMetrics(typical) {
  const box = document.getElementById("metrics");
  box.replaceChildren();
  for (const [label, value, sub] of [
    ["입력", "1장", "AI 시안"],
    ["산출물", `${typical.images}장`, "종류 하나당"],
    typical.frames ? ["렌더 프레임", `${typical.frames}`, "종류 하나당"]
                   : ["엔진 프레임", `${typical.engineFrames || "—"}`, "종류 하나당"],
    ["엔진 클립", `${typical.clips}개`, "Unity 에셋"]
  ]) {
    const m = el("div", "metric");
    m.appendChild(el("b", null, value));
    m.appendChild(el("span", null, `${label} · ${sub}`));
    box.appendChild(m);
  }
}

/* ---------- 목록 ---------- */

async function init() {
  if (STATIC) {
    document.body.classList.add("static");
    document.querySelector("#newBtn .nm").textContent = "파이프라인 소개";
    document.querySelector("#newBtn .plus").textContent = "ⓘ";
  } else {
    initOrder();
  }
  document.getElementById("newBtn").addEventListener("click", renderOverview);
  const data = await getJSON("/api/monsters");
  STAGES = data.stages;

  const list = document.getElementById("monsters");
  list.replaceChildren();
  for (const m of data.monsters) {
    const li = el("li");
    const b = el("button", "mon");
    b.dataset.name = m.name;
    // 대표 그림을 붙인다 — 이름만 늘어놓으면 만든 리소스 목록으로 보이지 않는다
    const th = el("span", "mon-thumb");
    if (m.thumb) {
      const img = el("img");
      img.src = url(m.thumb);
      img.alt = "";
      img.loading = "lazy";
      th.appendChild(img);
    }
    b.appendChild(th);
    const mid = el("span", "mon-mid");
    mid.appendChild(el("span", "nm", m.title));
    mid.appendChild(el("span", "st", m.complete ? "클립 · 엔진" : "만드는 중"));
    b.appendChild(mid);
    // 점 하나로 상태를 말하면 완료와 미완이 잘 안 갈린다 — 배지로 쓴다
    // **분모는 그 종류가 실제로 거치는 단계 수다.** 전체 목록 길이를 쓰면 목록은 2/7,
    //  상세는 2/8 로 갈린다 — 같은 화면에서 숫자가 다르면 어느 쪽도 못 믿는다 (2026-09-22 사용자)
    b.appendChild(el("span", m.complete ? "badge ok" : "badge",
      m.complete ? "완성" : `${m.stagesWithOutput}/${m.stageCount || STAGES.length}`));
    b.addEventListener("click", async () => {
      await showMonster(m.name);
      // 좁은 화면에서는 목록이 본문 위에 있다 — 다 그린 뒤 본문으로 내려 준다
      //  (그리기 전에 내리면 짧은 빈 본문 기준으로 내려가 제자리다)
      if (matchMedia("(max-width: 900px)").matches)
        document.getElementById("main").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    li.appendChild(b);
    list.appendChild(li);
  }

  // 완성된 종류 하나에서 "종류 하나당" 수치를 얻는다 — 기본 화면은 특정 종류의 것이 아니다
  const done = data.monsters.find(m => m.complete);
  if (done) {
    const one = await getJSON("/api/monster/" + encodeURIComponent(done.name));
    renderPipelineMetrics({
      images: one.stages.reduce((n, s) => n + s.items.filter(i => i.kind === "image" || i.kind === "gif").length, 0),
      frames: one.stages.find(s => s.key === "render").items.reduce((n, i) => n + (i.frames || 0), 0),
      clips: (one.stages.find(s => s.key === "engine").items.find(i => i.kind === "spec") || {}).clips || 0,
      engineFrames: (one.stages.find(s => s.key === "engine").items.find(i => i.kind === "spec") || {}).frames || 0
    });
  }
  renderOverview();
  if (STATIC) return;        // 실행 · 진행 스트림이 없다
  watchBusy();               // 새로 붙는 버튼도 실행 중이면 잠기게
  connectRun();
}

init().catch((e) => fail("시작", e));
