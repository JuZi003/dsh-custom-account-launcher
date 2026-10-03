window.__ModuleLoader__.load({
	id: "dsh-custom-account-launcher",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		/**
		 * Custom account identity for the sidebar launcher, plus a settings
		 * block rendered inside Settings → Account & Balance, between the
		 * account card and the balance card.
		 *
		 * Edits are a *draft*: they only move the block's own preview until
		 * Confirm is pressed. Confirm copies the draft over the applied
		 * identity, persists it, and regenerates the launcher stylesheet.
		 *
		 * The stylesheet is generated with literal values rather than CSS
		 * variables plus `data-*` switches. That earlier design is what broke:
		 * a `content: var(--x)` that fails to substitute is invalid at
		 * computed-value time, which leaves `content: normal` — no pseudo
		 * element at all, hence a blank nickname — and the shape rode on an
		 * attribute on <html> that did not always land. Literal values have
		 * neither failure mode.
		 *
		 * Everything runs in the page: the desktop shell serves its document
		 * from `dsh-app://app/`, so a host-side `webServer.tapIndex` never
		 * reaches it.
		 *
		 * Skin compatibility: the harness ships `corner-shape.css`, which sets
		 * `corner-shape: var(--dsw-corner-shape)` — a `superellipse(1.5)`
		 * squircle — on `*, :before, :after`. That universal rule is what makes
		 * a plain `border-radius: 50%` render as a squircle, so the round shape
		 * states `corner-shape: round` explicitly, winning on specificity.
		 *
		 * Nothing here is marked `!important` except the child-hiding rule. A
		 * skin styles this trigger's own box (background, size, colour) and
		 * leaves the two pseudo-elements alone, so no `!important` is needed —
		 * and adding it once measurably disturbed the maid skin's footer
		 * decoration, which is why the declarations stay plain.
		 *
		 * The shipped `AccountMenu` is never replaced. Its trigger keeps its
		 * menu (Settings / Feedback / Sign out, with the running-task check and
		 * confirmation) and we only repaint the two nodes it draws inside
		 * itself, via ::before / ::after.
		 *
		 * @module dsh-custom-account-launcher/client
		 */

		const PLUGIN_ID = "dsh-custom-account-launcher";
		const STYLE_TAG_ID = PLUGIN_ID + "/launcher.css";
		const BLOCK_MARKER = "data-dsh-custom-account-settings";
		const STORAGE_KEY = PLUGIN_ID + "/v1";

		const DEFAULTS = { name: "DSH", avatar: "", shape: "round" };

		/** The shipped trigger, matched through two anchors. */
		const TRIGGERS = [
			"[data-slot='settings.launcher'] button[aria-haspopup='menu']",
			"[data-slot='sidebar.settings'] button[aria-haspopup='menu']",
		];

		/** Block copy, keyed by the language the harness reports. */
		const TEXT = {
			zh: {
				title: "头像与昵称",
				preview: "预览",
				name: "昵称",
				namePlaceholder: "留空则只显示头像",
				avatar: "头像",
				pick: "选择图片",
				clear: "清除",
				shape: "形状",
				round: "圆形",
				squircle: "圆角方形",
				confirm: "确认",
				reset: "放弃改动",
				dirty: "有未确认的改动，侧边栏尚未更新。",
				clean: "侧边栏已应用当前设置。",
				hint: "只影响侧栏底部的头像与昵称，不会改动已绑定的账号；头像图片保存在本机。",
				empty: "（未设置昵称）",
			},
			en: {
				title: "Avatar & nickname",
				preview: "Preview",
				name: "Nickname",
				namePlaceholder: "Leave empty to show the avatar alone",
				avatar: "Avatar",
				pick: "Choose image",
				clear: "Clear",
				shape: "Shape",
				round: "Circle",
				squircle: "Rounded square",
				confirm: "Confirm",
				reset: "Discard",
				dirty: "Unconfirmed changes — the sidebar has not been updated yet.",
				clean: "The sidebar shows the current settings.",
				hint: "Affects only the sidebar launcher. The bound account is untouched; the image stays on this machine.",
				empty: "(no nickname)",
			},
		};

		/** Copy for the active locale; replaced whenever the locale changes. */
		let text = TEXT.en;

		/**
		 * Resolve the block copy from the harness locale.
		 *
		 * The harness owns its own language preference, independent of the
		 * browser's. Reading `navigator.language` reports the wrong language
		 * whenever the two differ.
		 *
		 * @param ctx - Client context carrying the `locale` service.
		 * @returns The dictionary matching the active locale.
		 */
		function resolveText(ctx) {
			let active = "";
			try {
				active = String(ctx.locale.getLocale().active || "").toLowerCase();
			} catch {
				return TEXT.en;
			}
			return active.indexOf("zh") === 0 ? TEXT.zh : TEXT.en;
		}

		/** A CSS <string> literal, escaped. */
		function cssText(value) {
			return (
				"'" +
				String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\a ") +
				"'"
			);
		}

		/** A CSS url() payload, escaped. */
		function cssUrl(value) {
			return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "");
		}

		/** First visible character, used by the initials avatar. */
		function initialOf(value) {
			const trimmed = String(value == null ? "" : value).trim();
			if (trimmed === "") return "?";
			return Array.from(trimmed)[0].toUpperCase();
		}

		/**
		 * Generate the launcher stylesheet for one identity, with literal values.
		 *
		 * @param identity - `{ name, avatar, shape }` to apply.
		 * @returns The stylesheet text.
		 */
		function buildLauncherCss(identity) {
			const before = TRIGGERS.map((t) => t + "::before").join(",\n");
			const after = TRIGGERS.map((t) => t + "::after").join(",\n");
			const collapsed = TRIGGERS.map((t) => t + "[data-collapsed='true']::after").join(",\n");
			const children =
				TRIGGERS.map((t) => t + " > span").join(",\n") +
				",\n" +
				TRIGGERS.map((t) => t + " > svg").join(",\n");

			// Deliberately unmarked. An earlier revision marked these `!important`
			// to harden against skins; that changed how this trigger rendered
			// under the maid skin (its footer decoration and the button's own
			// gradient), so the plain declarations are restored. The shipped
			// trigger carries no competing `content`, so nothing here needs the
			// extra weight.
			const avatarDecls = [
				"content: " + (identity.avatar ? "''" : cssText(initialOf(identity.name))) + ";",
			];
			if (identity.avatar) {
				avatarDecls.push('background-image: url("' + cssUrl(identity.avatar) + '");');
			}
			if (identity.shape === "round") {
				avatarDecls.push("corner-shape: round;");
			}

			const namePart = identity.name.trim()
				? after +
					" {\n  content: " +
					cssText(identity.name) +
					";\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n" +
					collapsed +
					" {\n  display: none;\n}"
				: after + " {\n  display: none;\n}";

			return (
				"/* Custom account launcher — literal values, regenerated on confirm. */\n" +
				children +
				" {\n  display: none !important;\n}\n\n" +
				before +
				" {\n" +
				"  flex: none;\n" +
				"  box-sizing: border-box;\n" +
				"  width: 24px;\n" +
				"  height: 24px;\n" +
				"  border-radius: 50%;\n" +
				"  display: flex;\n" +
				"  align-items: center;\n" +
				"  justify-content: center;\n" +
				"  overflow: hidden;\n" +
				"  background-color: var(--dsw-alias-brand-primary, #4d6bfe);\n" +
				"  background-position: center;\n" +
				"  background-size: cover;\n" +
				"  background-repeat: no-repeat;\n" +
				"  color: var(--dsw-alias-bg-base, #ffffff);\n" +
				"  font-size: 11px;\n" +
				"  font-weight: 600;\n" +
				"  line-height: 1;\n" +
				"  user-select: none;\n" +
				"  " +
				avatarDecls.join("\n  ") +
				"\n}\n\n" +
				namePart +
				"\n"
			);
		}

		const blockCss = `
[${BLOCK_MARKER}] {
  box-sizing: border-box;
  border: .5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-xl, 16px);
  background: var(--dsw-alias-settings-card-fill, transparent);
  color: var(--dsw-alias-label-primary);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  line-height: 22px;
}
[${BLOCK_MARKER}] .dsh-ca-title {
  font-size: 14px;
  font-weight: 500;
}
[${BLOCK_MARKER}] .dsh-ca-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;
}
[${BLOCK_MARKER}] .dsh-ca-label {
  color: var(--dsw-alias-label-secondary);
  flex: none;
}
[${BLOCK_MARKER}] .dsh-ca-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}
[${BLOCK_MARKER}] input[type='text'] {
  box-sizing: border-box;
  width: 220px;
  max-width: 46vw;
  height: 32px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-md, 8px);
  border: .5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: inherit;
  font: inherit;
}
[${BLOCK_MARKER}] button {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--dsw-radius-md, 8px);
  border: .5px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
  background: 0 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
[${BLOCK_MARKER}] button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
[${BLOCK_MARKER}] button:disabled {
  opacity: .5;
  cursor: default;
}
[${BLOCK_MARKER}] button[data-selected='yes'] {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
[${BLOCK_MARKER}] button[data-primary='yes']:not(:disabled) {
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-brand-primary, #4d6bfe);
  color: var(--dsw-alias-bg-base, #ffffff);
}
[${BLOCK_MARKER}] .dsh-ca-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
[${BLOCK_MARKER}] .dsh-ca-previewAvatar {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: var(--dsw-alias-brand-primary, #4d6bfe);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  color: var(--dsw-alias-bg-base, #ffffff);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
[${BLOCK_MARKER}] .dsh-ca-previewName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}
[${BLOCK_MARKER}] .dsh-ca-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
[${BLOCK_MARKER}] .dsh-ca-status {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
  min-width: 0;
}
[${BLOCK_MARKER}] .dsh-ca-hint {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
}
`;

		/** Insert the block stylesheet (the launcher part is rewritten on apply). */
		function ensureStyleTag() {
			const selector = "style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID) + "]";
			let tag = document.querySelector(selector);
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.plugin = PLUGIN_ID;
				tag.dataset.pluginCss = STYLE_TAG_ID;
				document.head.appendChild(tag);
			}
			return tag;
		}

		/** Read the applied identity, falling back to the defaults. */
		function loadApplied() {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				const parsed = raw ? JSON.parse(raw) : {};
				return {
					name: typeof parsed.name === "string" ? parsed.name : DEFAULTS.name,
					avatar: typeof parsed.avatar === "string" ? parsed.avatar : DEFAULTS.avatar,
					shape: parsed.shape === "squircle" ? "squircle" : "round",
				};
			} catch {
				return Object.assign({}, DEFAULTS);
			}
		}

		/** Persist the applied identity. */
		function persist(identity) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
			} catch {
				/* Storage unavailable: the setting stays for this session only. */
			}
		}

		/** Report on the page when the launcher anchors never resolve. */
		function selfCheck() {
			const badgeId = PLUGIN_ID + "-diagnostic";
			const matches = () => TRIGGERS.some((t) => document.querySelector(t) !== null);
			if (matches()) return;
			let ticks = 0;
			const timer = setInterval(() => {
				if (matches() || ++ticks > 20) {
					clearInterval(timer);
					if (matches() || document.getElementById(badgeId)) return;
					const slots = new Set();
					for (const node of document.querySelectorAll("[data-slot]")) {
						const value = node.getAttribute("data-slot");
						if (value && value.indexOf("settings") !== -1) slots.add(value);
					}
					const badge = document.createElement("div");
					badge.id = badgeId;
					badge.textContent =
						PLUGIN_ID +
						": 未找到账号入口按钮。附近 data-slot: " +
						(Array.from(slots).join(", ") || "（无）");
					badge.style.cssText =
						"position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:60vw;" +
						"padding:6px 10px;border-radius:8px;font:12px/1.5 system-ui,sans-serif;" +
						"background:#b3261e;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35)";
					document.body.appendChild(badge);
				}
			}, 500);
		}

		/**
		 * Build the settings block.
		 *
		 * @param ctl - Draft controller: `draft`, `patch`, `confirm`, `reset`, `dirty`.
		 * @returns The block element, carrying a `__sync` refresher.
		 */
		function buildBlock(ctl) {
			const block = document.createElement("div");
			block.setAttribute(BLOCK_MARKER, "");

			const title = document.createElement("div");
			title.className = "dsh-ca-title";
			title.textContent = text.title;
			block.appendChild(title);

			const previewAvatar = document.createElement("span");
			previewAvatar.className = "dsh-ca-previewAvatar";
			const previewName = document.createElement("span");
			previewName.className = "dsh-ca-previewName";
			const preview = document.createElement("span");
			preview.className = "dsh-ca-preview";
			preview.append(previewAvatar, previewName);

			const input = document.createElement("input");
			input.type = "text";
			input.maxLength = 24;
			input.placeholder = text.namePlaceholder;

			const file = document.createElement("input");
			file.type = "file";
			file.accept = "image/*";
			file.hidden = true;

			const pick = document.createElement("button");
			pick.type = "button";
			pick.textContent = text.pick;
			const clear = document.createElement("button");
			clear.type = "button";
			clear.textContent = text.clear;

			const roundBtn = document.createElement("button");
			roundBtn.type = "button";
			roundBtn.textContent = text.round;
			const squircleBtn = document.createElement("button");
			squircleBtn.type = "button";
			squircleBtn.textContent = text.squircle;

			const confirmBtn = document.createElement("button");
			confirmBtn.type = "button";
			confirmBtn.textContent = text.confirm;
			confirmBtn.dataset.primary = "yes";
			const resetBtn = document.createElement("button");
			resetBtn.type = "button";
			resetBtn.textContent = text.reset;

			const row = (label, controls) => {
				const line = document.createElement("div");
				line.className = "dsh-ca-row";
				const labelText = document.createElement("span");
				labelText.className = "dsh-ca-label";
				labelText.textContent = label;
				const holder = document.createElement("span");
				holder.className = "dsh-ca-controls";
				holder.appendChild(controls);
				line.append(labelText, holder);
				return line;
			};

			const avatarControls = document.createElement("span");
			avatarControls.className = "dsh-ca-controls";
			avatarControls.append(file, pick, clear);

			const shapeControls = document.createElement("span");
			shapeControls.className = "dsh-ca-controls";
			shapeControls.append(roundBtn, squircleBtn);

			const nameControls = document.createElement("span");
			nameControls.className = "dsh-ca-controls";
			nameControls.appendChild(input);

			block.append(
				row(text.preview, preview),
				row(text.name, nameControls),
				row(text.avatar, avatarControls),
				row(text.shape, shapeControls),
			);

			const status = document.createElement("div");
			status.className = "dsh-ca-status";
			const actions = document.createElement("span");
			actions.className = "dsh-ca-controls";
			actions.append(resetBtn, confirmBtn);
			const footer = document.createElement("div");
			footer.className = "dsh-ca-footer";
			footer.append(status, actions);
			block.appendChild(footer);

			const hint = document.createElement("div");
			hint.className = "dsh-ca-hint";
			hint.textContent = text.hint;
			block.appendChild(hint);

			/** Repaint the preview and the confirm affordances from the draft. */
			const sync = () => {
				const draft = ctl.draft;
				if (document.activeElement !== input && input.value !== draft.name) {
					input.value = draft.name;
				}
				previewAvatar.textContent = draft.avatar ? "" : initialOf(draft.name);
				previewAvatar.style.backgroundImage = draft.avatar
					? 'url("' + cssUrl(draft.avatar) + '")'
					: "none";
				previewAvatar.style.cornerShape = draft.shape === "round" ? "round" : "";
				previewName.textContent = draft.name.trim() || text.empty;
				clear.disabled = !draft.avatar;
				roundBtn.dataset.selected = draft.shape === "round" ? "yes" : "no";
				squircleBtn.dataset.selected = draft.shape === "squircle" ? "yes" : "no";
				const dirty = ctl.dirty();
				confirmBtn.disabled = !dirty;
				resetBtn.disabled = !dirty;
				status.textContent = dirty ? text.dirty : text.clean;
			};

			input.addEventListener("input", () => ctl.patch({ name: input.value }));
			pick.addEventListener("click", () => file.click());
			file.addEventListener("change", () => {
				const chosen = file.files && file.files[0];
				if (!chosen) return;
				const reader = new FileReader();
				reader.onload = () => {
					ctl.patch({ avatar: typeof reader.result === "string" ? reader.result : "" });
				};
				reader.readAsDataURL(chosen);
				file.value = "";
			});
			clear.addEventListener("click", () => ctl.patch({ avatar: "" }));
			roundBtn.addEventListener("click", () => ctl.patch({ shape: "round" }));
			squircleBtn.addEventListener("click", () => ctl.patch({ shape: "squircle" }));
			confirmBtn.addEventListener("click", () => ctl.confirm());
			resetBtn.addEventListener("click", () => ctl.reset());

			sync();
			block.__sync = sync;
			return block;
		}

		/** Apply the browser half. */
		function apply(ctx) {
			ctx.effect(() => {
				const disposers = [];
				const applied = loadApplied();
				let draft = Object.assign({}, applied);

				/** The block element currently on the page, if any. */
				let mounted = null;

				const tag = ensureStyleTag();
				disposers.push(() => tag.remove());

				/** Regenerate the launcher stylesheet from the applied identity. */
				const renderApplied = () => {
					tag.textContent = buildLauncherCss(applied) + blockCss;
				};

				const refreshBlock = () => {
					if (mounted && typeof mounted.__sync === "function") mounted.__sync();
				};

				const dirty = () =>
					draft.name !== applied.name ||
					draft.avatar !== applied.avatar ||
					draft.shape !== applied.shape;

				const ctl = {
					get draft() {
						return draft;
					},
					patch: (patch) => {
						Object.assign(draft, patch);
						refreshBlock();
					},
					/** Commit the draft: persist it and repaint the sidebar. */
					confirm: () => {
						Object.assign(applied, draft);
						persist(applied);
						renderApplied();
						refreshBlock();
					},
					reset: () => {
						draft = Object.assign({}, applied);
						refreshBlock();
					},
					dirty,
				};

				/**
				 * Mount the block immediately before the section's balance card,
				 * so it sits between the account card and the balance card.
				 */
				const mountBlock = () => {
					if (mounted && document.contains(mounted)) return true;
					const balance = document.querySelector("[class*='_balanceCard']");
					const section = balance && balance.parentElement;
					if (!section) return false;
					mounted = buildBlock(ctl);
					section.insertBefore(mounted, balance);
					return true;
				};

				/** Rebuild the block in the newly active language. */
				const relabel = () => {
					const next = resolveText(ctx);
					if (next === text) return;
					text = next;
					if (mounted && mounted.parentElement) mounted.parentElement.removeChild(mounted);
					mounted = null;
					mountBlock();
				};

				try {
					text = resolveText(ctx);
					renderApplied();
					mountBlock();
					const timer = setInterval(mountBlock, 1000);
					disposers.push(() => clearInterval(timer));
					disposers.push(ctx.locale.subscribe(relabel));
					selfCheck();
				} catch (error) {
					for (const dispose of disposers) dispose();
					throw error;
				}

				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "custom-account-launcher: repaint + settings block");
		}

		exports.apply = apply;
		exports.inject = ["locale"];
		return module.exports;
	},
});
