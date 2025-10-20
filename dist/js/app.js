  // GSAP

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

ScrollTrigger.matchMedia({
  // Только для экранов >= 1025px
  "(min-width: 1025px)": function () {
    let smoother = ScrollSmoother.create({
      smooth: 2,
      effects: true,
      normalizeScroll: true
    });

    ScrollTrigger.create({
      trigger: ".hero__link",
      pin: true,
      start: "top top",
      end: "bottom bottom",
      markers: false
    });
  }
});

window.addEventListener("load", function () {
  // preloader
  const preloader = document.querySelector('#preloader');

  setTimeout(() => {
    document.getElementById("preloader")?.classList.add("is-ready");
  }, 3000);

  // Формы
  document.querySelectorAll(".page-type__form.form").forEach(initStepperForm);

  function initStepperForm(form) {
    // ——— utils
    const $ = (sel, root = form) => root.querySelector(sel);
    const $all = (sel, root = form) => Array.from(root.querySelectorAll(sel));
    const onlyDigits = (v) => String(v || "").replace(/[^\d]/g, "");
    const fmt = (digits) => String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const num = (v) => {
      if (typeof v === "number") return v;
      const d = onlyDigits(v);
      return d ? parseInt(d, 10) : 0;
    };
    const labelTextForInput = (input) => {
      if (!input?.id) return "";
      const lbl = form.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      return lbl ? lbl.textContent.trim() : "";
    };

    // ——— DOM
    const steps = $all(".form__step");
    if (!steps.length) return;

    const btnBack   = $(".form__buttons .form__button.back");
    const btnPrev   = $(".form__buttons .form__prev");
    const btnNext   = $(".form__buttons .form__next");
    const btnFinish = $(".form__buttons .form__submit");
    const finalNote = $(".form__bottom > span");
    const priceNodes = $all(".form__price span");

    const container  = form.closest(".certificate__container") || document;
    const previewImg = container.querySelector(".certificate__img img");

    // ——— state
    let current = 0;
    let updateScheduled = false;
    const scheduleUpdate = () => {
      if (updateScheduled) return;
      updateScheduled = true;
      queueMicrotask(() => {
        updateScheduled = false;
        renderTotal();
        updateButtonsState();
      });
    };

    // ——— tabs
    const tabsList    = $('[data-tabs]');
    const tabLinks    = tabsList ? Array.from(tabsList.querySelectorAll('a[href^="#tab-"]')) : [];
    const tabPanels   = ['#tab-1', '#tab-2'].map((id) => $(id));
    const servicesBox = $('.form__services');

    function setControlsEnabled(root, enabled) {
      if (!root) return;
      root.querySelectorAll('input, select, textarea, button').forEach((el) => {
        el.disabled = !enabled;
        if (!enabled) {
          if (el.type === 'radio') el.checked = false;
          if (el.classList?.contains('input-text')) el.value = '';
        }
      });
    }

    function ensureFirstRadioChecked(root) {
      if (!root) return;
      const first = root.querySelector('input[type="radio"]');
      if (first && !root.querySelector('input[type="radio"]:checked')) {
        first.checked = true;
      }
    }

    let activeTabId = (tabLinks.find(a => a.hasAttribute('data-tabby-default'))?.getAttribute('href') || '#tab-1');

    // ——— показать/скрыть блок услуг
    function updateServicesVisibility() {
      if (!servicesBox) return;
      const hide = activeTabId === '#tab-2';
      servicesBox.style.display = hide ? 'none' : '';
      servicesBox.toggleAttribute('inert', hide);
    }

    function applyTabVisibility() {
      tabPanels.forEach((panel) => {
        if (!panel) return;
        const isActive = `#${panel.id}` === activeTabId;
        panel.hidden = !isActive;
        panel.toggleAttribute('inert', !isActive);
        setControlsEnabled(panel, isActive);
        if (isActive) ensureFirstRadioChecked(panel);
      });
      updateServicesVisibility();
      renderTotal();
      updateButtonsState();
    }

    if (tabsList && tabPanels.every(Boolean)) {
      applyTabVisibility();
      tabLinks.forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const href = a.getAttribute('href');
          if (!href || href === activeTabId) return;
          activeTabId = href;
          tabLinks.forEach(l => l.classList.toggle('is-active', l === a));
          applyTabVisibility();
        });
      });
    }

    // ——— validation
    function radiosInScopeByName(scopeEl) {
      const map = new Map();
      scopeEl.querySelectorAll('input[type="radio"]').forEach((r) => {
        if (r.disabled) return;
        if (!map.has(r.name)) map.set(r.name, []);
        map.get(r.name).push(r);
      });
      return map;
    }

    function isStepValid(stepEl) {
      let valid = true;
      const isFirstStep = stepEl === steps[0];
      const scope = (isFirstStep && tabsList && activeTabId) ? $(activeTabId) || stepEl : stepEl;

      const groups = radiosInScopeByName(scope);
      groups.forEach((radios) => {
        const isRequired = radios.some((r) => r.required);
        if (!isRequired) return;
        const fields = radios[0].closest(".form__fields");
        const manual = fields ? fields.querySelector(".input-text") : null;
        const ok = radios.some((r) => r.checked) || (manual && manual.value.trim() !== "");
        if (!ok) valid = false;
      });

      scope.querySelectorAll("input, select, textarea").forEach((ctrl) => {
        if (ctrl.disabled || ctrl.type === "radio" || !ctrl.required) return;
        if (ctrl.type === "email") {
          if (!ctrl.value.trim()) valid = false;
        } else if (!ctrl.checkValidity()) {
          valid = false;
        }
      });

      return valid;
    }

    // ——— расчёт
    function cert_getStep1Value() {
      if (activeTabId === '#tab-1') {
        const panel = $('#tab-1');
        if (!panel) return 0;
        const manual = panel.querySelector('.input-text');
        const checked = panel.querySelector('input[name="price"]:checked');
        if (manual && manual.value.trim()) return num(manual.value);
        if (checked) return num(checked.value);
        return 0;
      }
      if (activeTabId === '#tab-2') {
        const panel = $('#tab-2');
        if (!panel) return 0;
        const checked = panel.querySelector('input[name="services"]:checked');
        if (checked) return num(checked.value);
        return 0;
      }
      return 0;
    }

    function cert_getAmountValue() {
      const anyAmtRadio = form.querySelector('input[type="radio"][name="amount"]');
      if (!anyAmtRadio) return 1;
      const fields = anyAmtRadio.closest(".form__fields");
      const manual = fields ? fields.querySelector(".input-text") : null;
      const checked = form.querySelector('input[name="amount"]:checked');

      if (manual && manual.value.trim()) {
        const n = Math.max(1, num(manual.value));
        return n || 1;
      }
      if (checked) {
        const labelNum = num(labelTextForInput(checked));
        return labelNum || 1;
      }
      return 1;
    }

    function subs_getPackPrice() {
      const typeChecked = form.querySelector('input[name="type"]:checked:not([data-img])');
      const amountChecked = form.querySelector('input[name="amount"]:checked[data-prices]');
      if (!typeChecked || !amountChecked) return 0;
      let map = {};
      try {
        map = JSON.parse(amountChecked.dataset.prices || "{}");
      } catch (e) { map = {}; }
      const price = map[typeChecked.id];
      return typeof price === "number" ? price : num(price);
    }

    function computeTotal() {
      if (form.classList.contains("subscription__form")) {
        return subs_getPackPrice() || 0;
      }
      const priceOrService = cert_getStep1Value();
      const qty = cert_getAmountValue();
      return priceOrService * qty;
    }

    function renderTotal() {
      const sum = computeTotal();
      if (!priceNodes.length) return;
      const text = sum.toLocaleString("ru-RU");
      priceNodes.forEach((n) => (n.textContent = text));
    }

    // ——— шаги и кнопки
    function setStepEnabled(stepEl, enabled) {
      stepEl.hidden = !enabled;
      stepEl.toggleAttribute("inert", !enabled);
      stepEl.querySelectorAll("input, select, textarea, button").forEach((el) => (el.disabled = !enabled));
    }

    function updateButtonsState() {
      const isLast = current === steps.length - 1;
      const valid  = isStepValid(steps[current]);
      if (btnNext)   btnNext.disabled   = !isLast && !valid;
      if (btnFinish) btnFinish.disabled =  isLast && !valid;
    }

    function showStep(i) {
      steps.forEach((el, idx) => setStepEnabled(el, idx === i));
      const isFirst = i === 0;
      const isLast  = i === steps.length - 1;
      if (btnBack)   btnBack.style.display   = isFirst ? "inline-block" : "none";
      if (btnPrev)  { btnPrev.style.display  = isFirst ? "none" : "inline-block"; btnPrev.disabled = isFirst; }
      if (btnNext)   btnNext.style.display   = isLast  ? "none"  : "inline-block";
      if (btnFinish) btnFinish.style.display = isLast  ? "inline-block" : "none";
      if (finalNote) finalNote.style.display = isLast  ? "block" : "none";
      renderTotal();
      updateButtonsState();
    }

    btnPrev?.addEventListener("click", (e) => {
      e.preventDefault();
      if (current > 0) { current--; showStep(current); }
    });
    btnNext?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!isStepValid(steps[current])) return;
      if (current < steps.length - 1) { current++; showStep(current); }
    });
    btnFinish?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!isStepValid(steps[current])) return;
      form.submit();
    });

    // ——— синхронизация manual ↔ radio
    if (form.classList.contains("certificate__form")) {
      $all(".form__fields").forEach((fields) => {
        const manual = fields.querySelector(".input-text");
        const radios = fields.querySelectorAll('input[type="radio"][name]');
        if (!manual || !radios.length) return;

        manual.addEventListener("input", () => {
          const d = onlyDigits(manual.value);
          manual.value = d ? fmt(d) : "";
          radios.forEach((r) => (r.checked = false));
          const isAmountGroup = radios[0]?.name === "amount";
          if (isAmountGroup) {
            const n = parseInt(d || "0", 10);
            if (d !== "" && n === 0) manual.value = "";
          }
          scheduleUpdate();
        });

        manual.addEventListener("blur", () => {
          const d = onlyDigits(manual.value);
          manual.value = d ? fmt(String(parseInt(d, 10))) : "";
          scheduleUpdate();
        });

        radios.forEach((r) => {
          r.addEventListener("change", () => {
            if (r.checked && manual.value) manual.value = "";
            scheduleUpdate();
          });
        });
      });
    }

    // ——— превью дизайна
    if (previewImg && form.classList.contains("certificate__form")) {
      const designInputs = form.querySelectorAll('input[name="type"][data-img]');
      const swapImage = (src) => {
        if (!src) return;
        previewImg.src = src;
        previewImg.classList.add("fade");
        setTimeout(() => previewImg.classList.remove("fade"), 300);
      };
      designInputs.forEach((input) => {
        input.addEventListener("change", () => {
          if (input.checked && input.dataset.img) swapImage(input.dataset.img);
        });
      });
      const chosen = form.querySelector('input[name="type"][data-img]:checked');
      if (chosen?.dataset?.img) swapImage(chosen.dataset.img);
    }

    // поздравление
    const nameInput = $('input[name="nameTo"]');
    const congratInput = $('input[name="congratulations"]');
    const congratCheck = $('input[name="check-congrat"]');

    function updateCongratVisibility() {
      if (!congratInput || !congratCheck) return;
      const on = congratCheck.checked;
      congratInput.hidden   = !on;
      congratInput.disabled = !on;
      congratInput.required = on;
      nameInput.hidden   = !on;
      nameInput.disabled = !on;
      nameInput.required = on;
      if (!on) congratInput.value = '';
      if (!on) nameInput.value = '';
      updateButtonsState();
    }

    congratCheck?.addEventListener('change', updateCongratVisibility);
    updateCongratVisibility();

    // ——— общие слушатели
    form.addEventListener("input",  scheduleUpdate);
    form.addEventListener("change", scheduleUpdate);
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const isLast = current === steps.length - 1;
        const valid  = isStepValid(steps[current]);
        if (!isLast || !valid) e.preventDefault();
      }
    });

    // ——— старт
    showStep(current);
    if (tabsList && activeTabId) ensureFirstRadioChecked($(activeTabId));
    renderTotal();
    updateButtonsState();
  }



  // Модалка

  function hidePopup(popup) {
    const modalsParent = popup.parentElement;
    modalsParent.addEventListener("click", function (e) {
      const target = e.target;
      if (
        target.classList.contains("modal__close") ||
        target.classList.contains("modals")
      ) {
        popup.style.transition = "opacity 0.4s";
        popup.style.opacity = "0";
        setTimeout(() => {
          popup.style.display = "none";
          if (modalsParent) {
            modalsParent.style.opacity = "0";
            modalsParent.style.display = "none";
          }
          document.body.classList.remove("modal-open");
        }, 400);
      }
    });
  }

  function showPopup(popup) {
    const modalsParent = popup.parentElement;
    if (modalsParent) {
      modalsParent.style.display = "flex";
      modalsParent.style.transition = "opacity 0.4s";
      modalsParent.style.opacity = "1"; 
    }

    popup.style.display = "block";
    setTimeout(() => {
      popup.style.transition = "opacity 0.4s";
      popup.style.opacity = "1";
    }, 10);

    document.body.classList.add("modal-open");
  }

  let modalBtns = document.querySelectorAll(".modal-btn");
  let modals = document.querySelectorAll(".modal");

  modals.forEach((modal) => {
    modal.style.display = "none";
    hidePopup(modal);
  });

  modalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      let modalType = btn.dataset.modal;
      let modalToShow = document.querySelector(
        `.modal[data-modal="${modalType}"]`
      );

      if (modalToShow) {
        showPopup(modalToShow);
      }
    });
  });

  // Маска для телефона

  [].forEach.call( document.querySelectorAll('input[type="tel"]'), function(input) {
    var keyCode;
    function mask(event) {
        event.keyCode && (keyCode = event.keyCode);
        var pos = this.selectionStart;
        if (pos < 3) event.preventDefault();
        var matrix = "+7 (___) ___ ____",
            i = 0,
            def = matrix.replace(/\D/g, ""),
            val = this.value.replace(/\D/g, ""),
            new_value = matrix.replace(/[_\d]/g, function(a) {
                return i < val.length ? val.charAt(i++) || def.charAt(i) : a
            });
        i = new_value.indexOf("_");
        if (i != -1) {
            i < 5 && (i = 3);
            new_value = new_value.slice(0, i)
        }
        var reg = matrix.substring(0, this.value.length).replace(/_+/g,
            function(a) {
                return "\\d{1," + a.length + "}"
            }).replace(/[+()]/g, "\\$&");
        reg = new RegExp("^" + reg + "$");
        if (!reg.test(this.value) || this.value.length < 5 || keyCode > 47 && keyCode < 58) this.value = new_value;
        if (event.type == "blur" && this.value.length < 5)  this.value = ""
    }

    input.addEventListener("input", mask, false);
    input.addEventListener("focus", mask, false);
    input.addEventListener("blur", mask, false);
    input.addEventListener("keydown", mask, false)

  });

  // Tabby
  var tabs = new Tabby('[data-tabs]');
});