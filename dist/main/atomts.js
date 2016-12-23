"use strict";
const tslib_1 = require("tslib");
const clientResolver_1 = require("../client/clientResolver");
const atom_1 = require("atom");
const lodash_1 = require("lodash");
const error_pusher_1 = require("./error_pusher");
const typescript_editor_pane_1 = require("./typescript_editor_pane");
const statusPanel_1 = require("./atom/components/statusPanel");
const atomConfig = require("./atom/atomConfig");
const autoCompleteProvider_1 = require("./atom/autoCompleteProvider");
const hyperclickProvider = require("../hyperclickProvider");
const renameView = require("./atom/views/renameView");
const tsconfig = require("tsconfig/dist/tsconfig");
const lodash_2 = require("lodash");
const subscriptions = new atom_1.CompositeDisposable();
exports.clientResolver = new clientResolver_1.ClientResolver();
exports.config = atomConfig.schema;
require("./atom/components");
const commands_1 = require("./atom/commands");
let linter;
let statusBar;
function activate(state) {
    require('atom-package-deps').install('atom-typescript').then(() => {
        let statusPriority = 100;
        for (const panel of statusBar.getRightTiles()) {
            if (panel.getItem().tagName === "GRAMMAR-SELECTOR-STATUS") {
                statusPriority = panel.getPriority() - 1;
            }
        }
        const statusPanel = statusPanel_1.StatusPanel.create();
        statusBar.addRightTile({
            item: statusPanel,
            priority: statusPriority
        });
        subscriptions.add(statusPanel);
        const errorPusher = new error_pusher_1.ErrorPusher();
        exports.clientResolver.on("pendingRequestsChange", () => {
            const pending = lodash_2.flatten(lodash_2.values(exports.clientResolver.clients).map(cl => cl.pending));
            statusPanel.setPending(pending);
        });
        if (linter) {
            errorPusher.setLinter(linter);
            exports.clientResolver.on("diagnostics", ({ type, filePath, diagnostics }) => {
                errorPusher.setErrors(type, filePath, diagnostics);
            });
        }
        renameView.attach();
        commands_1.registerCommands({
            clearErrors() {
                errorPusher.clear();
            },
            getClient(filePath) {
                return tslib_1.__awaiter(this, void 0, void 0, function* () {
                    for (const pane of panes) {
                        if (pane.filePath === filePath) {
                            return pane.client;
                        }
                    }
                    return exports.clientResolver.get(filePath);
                });
            },
            statusPanel,
        });
        const panes = [];
        const onSave = lodash_1.debounce((pane) => {
            console.log("checking errors for all panes for", pane.filePath);
            const files = panes
                .sort((a, b) => a.activeAt - b.activeAt)
                .filter(_pane => _pane.filePath && _pane.isTypescript && _pane.client === pane.client)
                .map(pane => pane.filePath);
            pane.client.executeGetErr({ files, delay: 100 });
        }, 50);
        subscriptions.add(atom.workspace.observeTextEditors((editor) => {
            panes.push(new typescript_editor_pane_1.TypescriptEditorPane(editor, {
                onDispose(pane) {
                    if (activePane === pane) {
                        activePane = null;
                    }
                    panes.splice(panes.indexOf(pane), 1);
                    errorPusher.setErrors("syntaxDiag", pane.filePath, []);
                    errorPusher.setErrors("semanticDiag", pane.filePath, []);
                },
                onSave,
                statusPanel,
            }));
        }));
        let activePane = panes.find(pane => pane.editor === atom.workspace.getActiveTextEditor());
        if (activePane) {
            activePane.onActivated();
        }
        subscriptions.add(atom.workspace.onDidChangeActivePaneItem((editor) => {
            if (activePane) {
                activePane.onDeactivated();
                activePane = null;
            }
            if (atom.workspace.isTextEditor(editor)) {
                const pane = panes.find(pane => pane.editor === editor);
                if (pane) {
                    activePane = pane;
                    pane.onActivated();
                }
            }
        }));
    });
}
exports.activate = activate;
function deactivate() {
    subscriptions.dispose();
}
exports.deactivate = deactivate;
function serialize() {
    return {};
}
exports.serialize = serialize;
function consumeLinter(registry) {
    console.log("consume linter");
    linter = registry.register({
        name: ""
    });
    console.log("linter is", linter);
}
exports.consumeLinter = consumeLinter;
function consumeStatusBar(_statusBar) {
    statusBar = _statusBar;
}
exports.consumeStatusBar = consumeStatusBar;
function provide() {
    return [
        new autoCompleteProvider_1.AutocompleteProvider(exports.clientResolver),
    ];
}
exports.provide = provide;
function getHyperclickProvider() {
    return hyperclickProvider;
}
exports.getHyperclickProvider = getHyperclickProvider;
function loadProjectConfig(sourcePath) {
    return exports.clientResolver.get(sourcePath).then(client => {
        return client.executeProjectInfo({ needFileNameList: false, file: sourcePath }).then(result => {
            return tsconfig.load(result.body.configFileName);
        });
    });
}
exports.loadProjectConfig = loadProjectConfig;
