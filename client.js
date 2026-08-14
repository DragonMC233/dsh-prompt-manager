// dsh-prompt-manager client half — a settings.section tab for viewing the
// live system-prompt catalog, managing/switching prompt presets (builtin vs
// personalized, toggle switches), and visualizing the assembly pipeline
// (幕布): how sections from different sources aggregate into the final prompt.
// Served as a browser module through the client module host; talks to the
// host half over the loopback /api RPC channel (prompt-manager/* endpoints).
window.__ModuleLoader__.load({
	id: "dsh-prompt-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const { useCallback, useEffect, useState } = react;
		const createElement = react.createElement;

		// ── style kit (native theme tokens) ───────────────────────────────────
		const styles = {
			root: { display: "flex", flexDirection: "column", gap: 12, color: "var(--dsw-alias-label-primary)" },
			card: {
				background: "var(--dsw-alias-bg-module-platform)",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: 12,
				padding: "12px 14px",
				display: "flex",
				flexDirection: "column",
				gap: 8
			},
			title: { fontSize: 13, fontWeight: 500, lineHeight: 1.5, margin: 0 },
			hint: { fontSize: 12, lineHeight: 1.6, margin: 0, color: "var(--dsw-alias-label-tertiary)" },
			row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
			pre: {
				whiteSpace: "pre-wrap",
				wordBreak: "break-word",
				fontFamily: "var(--ds-font-family-code, monospace)",
				fontSize: 12,
				lineHeight: 1.5,
				margin: 0,
				maxHeight: 240,
				overflow: "auto",
				color: "var(--dsw-alias-label-secondary)"
			},
			sectionHead: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--dsw-alias-border-l2)" },
			sectionName: { fontSize: 12, fontWeight: 600, fontFamily: "var(--ds-font-family-code, monospace)" },
			badge: {
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-secondary)",
				border: "1px solid var(--dsw-alias-border-l3)",
				borderRadius: 999,
				padding: "0 8px",
				fontSize: 11,
				lineHeight: "18px",
				whiteSpace: "nowrap"
			},
			builtinBadge: {
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-tertiary)",
				border: "1px dashed var(--dsw-alias-border-l3)",
				borderRadius: 999,
				padding: "0 8px",
				fontSize: 11,
				lineHeight: "18px",
				whiteSpace: "nowrap"
			},
			userBadge: {
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground, #fff)",
				borderRadius: 999,
				padding: "0 8px",
				fontSize: 11,
				lineHeight: "18px",
				whiteSpace: "nowrap"
			},
			activeBadge: {
				background: "var(--dsw-alias-state-success-primary)",
				color: "var(--dsw-alias-label-primary-foreground, #fff)",
				borderRadius: 999,
				padding: "0 8px",
				fontSize: 11,
				lineHeight: "18px",
				whiteSpace: "nowrap"
			},
			button: {
				boxSizing: "border-box",
				height: 28,
				font: "inherit",
				cursor: "pointer",
				border: "1px solid var(--dsw-alias-border-l2)",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-1)",
				borderRadius: 14,
				padding: "0 12px",
				fontSize: 12,
				lineHeight: "26px"
			},
			primary: { border: "none", background: "var(--dsw-alias-button-primary-fill)", color: "var(--dsw-alias-label-primary-foreground, #fff)" },
			danger: { color: "var(--dsw-alias-state-error-primary)" },
			input: {
				boxSizing: "border-box",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				height: 32,
				font: "inherit",
				color: "var(--dsw-alias-label-primary)",
				borderRadius: 8,
				padding: "0 12px",
				fontSize: 13,
				flex: 1,
				minWidth: 120
			},
			textarea: {
				boxSizing: "border-box",
				width: "100%",
				minHeight: 220,
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				borderRadius: 8,
				padding: 10,
				fontFamily: "var(--ds-font-family-code, monospace)",
				fontSize: 12,
				lineHeight: 1.5,
				resize: "vertical"
			},
			error: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12, margin: 0 },
			stage: { display: "flex", alignItems: "center", gap: 8, color: "var(--dsw-alias-label-tertiary)", fontSize: 12, margin: "4px 0 0" },
			arrow: { color: "var(--dsw-alias-label-tertiary)", fontSize: 16, textAlign: "center", margin: 0 },
			toggleBase: {
				boxSizing: "border-box",
				width: 40,
				height: 22,
				borderRadius: 11,
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				position: "relative",
				cursor: "pointer",
				flex: "none",
				padding: 0
			},
			toggleOn: { background: "var(--dsw-alias-button-primary-fill)", borderColor: "transparent" },
			knob: {
				position: "absolute",
				top: 2,
				left: 2,
				width: 16,
				height: 16,
				borderRadius: 8,
				background: "var(--dsw-alias-label-primary-foreground, #fff)",
				transition: "left .12s ease"
			},
			knobOn: { left: 20 }
		};

		function callRpc(call, endpoint, payload) {
			return call(endpoint, payload).then((result) => {
				if (result && result.ok === true) return result.value;
				throw new Error(result && result.error ? result.error.message : "RPC failed");
			});
		}

		function Toggle({ on, onChange, disabled }) {
			return createElement("button", {
				role: "switch",
				"aria-checked": on,
				"aria-label": on ? "关闭此预设" : "启用此预设",
				title: on ? "已启用：切换后下一个模型步骤生效" : "已停用",
				style: { ...styles.toggleBase, ...(on ? styles.toggleOn : {}) },
				onClick: onChange,
				disabled: disabled
			}, createElement("span", { style: { ...styles.knob, ...(on ? styles.knobOn : {}) } }));
		}

		function PresetRow({ preset, active, onToggle, onEdit, onDelete }) {
			const isUser = preset.kind === "user";
			return createElement(
				"div",
				{ style: styles.card },
				createElement(
					"div",
					{ style: styles.row },
					createElement("span", { style: { fontSize: 13, fontWeight: 500 } }, preset.label),
					createElement("span", { style: isUser ? styles.userBadge : styles.builtinBadge }, isUser ? "个性化" : "内置"),
					createElement("span", { style: styles.badge }, preset.name),
					active ? createElement("span", { style: styles.activeBadge }, "当前生效") : null,
					createElement("span", { style: styles.hint }, `${preset.ruleCount} 条规则`)
				),
				preset.description ? createElement("p", { style: styles.hint }, preset.description) : null,
				createElement("p", { style: styles.hint }, preset.path),
				createElement(
					"div",
					{ style: styles.row },
					createElement(Toggle, { on: active, onChange: onToggle }),
					createElement("span", { style: styles.hint }, active ? "已启用" : "未启用"),
					createElement("span", { style: { flex: 1 } }),
					isUser
						? createElement("button", { style: styles.button, onClick: onEdit }, "编辑")
						: createElement("button", { style: styles.button, onClick: onEdit }, "另存为个性化"),
					isUser
						? createElement("button", { style: { ...styles.button, ...styles.danger }, onClick: onDelete }, "删除")
						: null
				)
			);
		}

		function PromptManagerSection({ call }) {
			const [presets, setPresets] = useState(null);
			const [error, setError] = useState(null);
			const [busy, setBusy] = useState(false);
			const [newName, setNewName] = useState("");
			const [editing, setEditing] = useState(null); // { name, yaml }

			const loadAll = useCallback(() => {
				setBusy(true);
				setError(null);
				return callRpc(call, "prompt-manager/listPresets", {})
					.then((p) => { setPresets(p); setBusy(false); })
					.catch((e) => { setError(String(e && e.message ? e.message : e)); setBusy(false); });
			}, [call]);

			useEffect(() => { void loadAll(); }, [loadAll]);

			const run = useCallback((action) => {
				setBusy(true);
				setError(null);
				return action()
					.then(() => { void loadAll(); })
					.catch((e) => { setError(String(e && e.message ? e.message : e)); setBusy(false); });
			}, [loadAll]);

			const toggle = (name, active) => run(() => callRpc(call, "prompt-manager/setActive", { name: active ? "" : name }));
			const remove = (name) => run(() => callRpc(call, "prompt-manager/deletePreset", { name }));
			const create = () => {
				const name = newName.trim();
				if (!name) return;
				setNewName("");
				void run(() => callRpc(call, "prompt-manager/createPreset", { name }));
			};
			const openEditor = (name) => {
				void callRpc(call, "prompt-manager/getPresetYaml", { name })
					.then((yaml) => setEditing({ name, yaml }))
					.catch((e) => setError(String(e && e.message ? e.message : e)));
			};
			const saveEditor = () => {
				if (!editing) return;
				const name = editing.name;
				setEditing(null);
				void run(() => callRpc(call, "prompt-manager/updatePresetYaml", { name, yaml: editing.yaml }));
			};

			const children = [];
			children.push(createElement("h3", { style: styles.title }, "提示词管理"));

			if (error) children.push(createElement("p", { style: styles.error }, `错误：${error}`));

			// 幕布入口（全屏独立页面）——设置页唯一入口，提示词聚合视图全部在画布
			children.push(createElement(
				"div",
				{ style: styles.card },
				createElement(
					"div",
					{ style: styles.row },
					createElement("h4", { style: { ...styles.title, margin: 0 } }, "组装流水线（幕布）"),
					createElement("span", { style: { flex: 1 } }),
					createElement("button", { style: { ...styles.button, ...styles.primary }, onClick: () => { window.open("/prompt-manager/pipeline", "_blank"); } }, "全屏查看幕布")
				),
				createElement("p", { style: styles.hint }, "以画布流程图查看最终发送提示词的构造过程（来源片段 → 预设覆盖 → 变量插值 → 最终渲染），在新页面全屏展示。")
			));

			// Presets（所有视图共用）
			children.push(createElement("h4", { style: styles.title }, "预设方案"));
			children.push(
				createElement(
					"div",
					{ style: styles.card },
					createElement("p", { style: styles.hint }, "「提示词预设」只决定系统提示词内容，与「Agent 预设」（会话工具/插件组合）是两套独立机制。内置预设随插件分发（只读）；个性化预设默认关闭，用开关启用后下一个模型步骤生效。"),
					presets !== null
						? createElement("p", { style: styles.hint }, `个性化预设目录：${presets.storeRoot}　|　激活指针：${presets.activePath}`)
						: null,
					presets === null
						? createElement("p", { style: styles.hint }, busy ? "加载中…" : "无预设")
						: createElement(
								"div",
								{ style: { display: "flex", flexDirection: "column", gap: 8 } },
								presets.presets.length === 0
									? createElement("p", { style: styles.hint }, "暂无预设。可新建个性化预设，或使用 save_prompt 工具固化优化后的提示词。")
									: presets.presets.map((preset) =>
											createElement(PresetRow, {
												key: preset.name,
												preset,
												active: preset.name === presets.active,
												onToggle: () => toggle(preset.name, preset.name === presets.active),
												onEdit: () => openEditor(preset.name),
												onDelete: () => remove(preset.name)
											})
										),
								createElement(
									"div",
									{ style: styles.row },
									createElement("input", {
										style: styles.input,
										value: newName,
										placeholder: "新个性化预设名（小写字母/数字/-/_）",
										onChange: (e) => setNewName(e.target.value),
										onKeyDown: (e) => { if (e.key === "Enter") create(); }
									}),
									createElement("button", { style: { ...styles.button, ...styles.primary }, onClick: create, disabled: busy }, "新建"),
									createElement("button", { style: styles.button, onClick: () => { void loadAll(); }, disabled: busy }, "刷新")
								)
							)
				)
			);

			// Editor
			if (editing) {
				children.push(
					createElement(
						"div",
						{ style: styles.card },
						createElement("h4", { style: styles.title }, `编辑预设 ${editing.name}`),
						createElement("p", { style: styles.hint }, "YAML 格式：label / description / overrides（action: replace|insert|remove, section, text, order?, after?）。替换文本中的 {{variable}} 会正常插值。"),
						createElement("textarea", {
							style: styles.textarea,
							value: editing.yaml,
							onChange: (e) => setEditing({ ...editing, yaml: e.target.value })
						}),
						createElement(
							"div",
							{ style: styles.row },
							createElement("button", { style: { ...styles.button, ...styles.primary }, onClick: saveEditor, disabled: busy }, "保存"),
							createElement("button", { style: styles.button, onClick: () => setEditing(null) }, "取消")
						)
					)
				);
			}

			// 提示词聚合视图（来源分段 / 渲染结果）已从设置页移除——见
			// docs/DESIGN.md §15.5f：设置页内嵌视图使用全局组装（scope=global，
			// 变量缺失、工具段缺失），与模型实际收到的 agent 组装不一致，
			// 属误导性视图；画布（/prompt-manager/pipeline）是唯一权威视图。

			return createElement("div", { style: styles.root }, ...children);
		}

		/** Browser plugin body: mount the settings section. */
		function apply(ctx) {
			// slots.inject waits for the settings shell to declare the
			// settings.section slot, then registers; the registration disposes
			// automatically with this fiber.
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "prompt-manager",
				order: 25,
				label: () => "提示词管理",
				inject: () => ({
					call: (endpoint, payload) => ctx.connection.rpc.call("/api", endpoint, payload)
				})
			}, PromptManagerSection));
		}

		/** Required services (cordis fiber inject — service names, not package names).
		 *  `slots` is provided by @deepseek-ai/dsh-client-runtime, `connection` by
		 *  @deepseek-ai/dsh-client-connection; the package-name list in package.json
		 *  `dsh.client.inject` only drives client-module loading, not fiber inject. */
		const inject = ["slots", "connection"];

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
