"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.BACKEND_API_BASE = exports.API_BASE = void 0;
exports.requestDeepDive = requestDeepDive;
exports.fetchPipelineStatus = fetchPipelineStatus;
exports.fetchMetrics = fetchMetrics;
exports.fetchGpuMetrics = fetchGpuMetrics;
exports.fetchTrends = fetchTrends;
exports.fetchCityGraph = fetchCityGraph;
exports.fetchNeighborhoodGraph = fetchNeighborhoodGraph;
exports.fetchUserMemories = fetchUserMemories;
// Modal deployed endpoint — set via VITE_MODAL_URL, fallback to local proxy
exports.API_BASE = import.meta.env.VITE_MODAL_URL || '/api/data';
exports.BACKEND_API_BASE = import.meta.env.VITE_BACKEND_URL || '/api/data';
var LOCAL_USER_ID_KEY = 'aleithia.localUserId';
var BACKEND_METADATA_TIMEOUT_MS = 10000;
function getLocalUserId() {
    var _a;
    if (typeof window === 'undefined') {
        return 'local-user';
    }
    var existing = (_a = window.localStorage.getItem(LOCAL_USER_ID_KEY)) === null || _a === void 0 ? void 0 : _a.trim();
    if (existing) {
        return existing;
    }
    var generated = "local-".concat(crypto.randomUUID());
    window.localStorage.setItem(LOCAL_USER_ID_KEY, generated);
    return generated;
}
function withLocalUserId(init) {
    if (init === void 0) { init = {}; }
    var headers = new Headers(init.headers);
    headers.set('x-user-id', getLocalUserId());
    return __assign(__assign({}, init), { headers: headers });
}
function fetchBaseJSON(base, path, init, options) {
    return __awaiter(this, void 0, void 0, function () {
        var timeoutMs, controller, didTimeout, timeoutId, onAbort, res, error, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeoutMs = options === null || options === void 0 ? void 0 : options.timeoutMs;
                    controller = timeoutMs ? new AbortController() : null;
                    didTimeout = false;
                    timeoutId = timeoutMs && controller
                        ? globalThis.setTimeout(function () {
                            didTimeout = true;
                            controller.abort();
                        }, timeoutMs)
                        : null;
                    onAbort = function () { return controller === null || controller === void 0 ? void 0 : controller.abort(); };
                    if (controller && (init === null || init === void 0 ? void 0 : init.signal)) {
                        init.signal.addEventListener('abort', onAbort, { once: true });
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, fetch("".concat(base).concat(path), controller ? __assign(__assign({}, init), { signal: controller.signal }) : init)];
                case 2:
                    res = _a.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text()];
                case 3:
                    error = _a.sent();
                    throw new Error("API error ".concat(res.status, ": ").concat(error));
                case 4: return [2 /*return*/, res.json()];
                case 5:
                    error_1 = _a.sent();
                    if (didTimeout && error_1 instanceof DOMException && error_1.name === 'AbortError') {
                        throw new Error("Request timed out after ".concat(timeoutMs, "ms: ").concat(path));
                    }
                    throw error_1;
                case 6:
                    if (timeoutId !== null) {
                        globalThis.clearTimeout(timeoutId);
                    }
                    if (init === null || init === void 0 ? void 0 : init.signal) {
                        init.signal.removeEventListener('abort', onAbort);
                    }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function fetchJSON(path, init) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchBaseJSON(exports.API_BASE, path, init)];
        });
    });
}
function fetchBackendJSON(path, init, options) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchBaseJSON(exports.BACKEND_API_BASE, path, init, options)];
        });
    });
}
function requestDeepDive(question, brief, neighborhood, businessType) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchJSON('/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: question,
                        brief: brief,
                        neighborhood: neighborhood,
                        business_type: businessType,
                    }),
                })];
        });
    });
}
var DEFAULT_LEGACY_GPU_STATUS = {
    h100_llm: 'disabled',
    t4_classifier: 'disabled',
    t4_sentiment: 'disabled',
    t4_cctv: 'disabled',
};
function synthesizeLegacyGpuStatus(metrics, runtimeStatus) {
    var _a;
    if (metrics) {
        return __assign(__assign({}, DEFAULT_LEGACY_GPU_STATUS), Object.fromEntries(Object.entries(metrics).map(function (_a) {
            var gpu = _a[0], entry = _a[1];
            return [
                gpu,
                entry.status === 'disabled' ? 'disabled' : 'available',
            ];
        })));
    }
    return __assign(__assign({}, DEFAULT_LEGACY_GPU_STATUS), ((_a = runtimeStatus === null || runtimeStatus === void 0 ? void 0 : runtimeStatus.gpu_status) !== null && _a !== void 0 ? _a : {}));
}
function fetchPipelineStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var status, runtimeStatus, gpuMetrics, _a, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, fetchBackendJSON('/status', undefined, { timeoutMs: BACKEND_METADATA_TIMEOUT_MS })];
                case 1:
                    status = _d.sent();
                    runtimeStatus = null;
                    gpuMetrics = null;
                    if (!import.meta.env.VITE_MODAL_URL) return [3 /*break*/, 8];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, fetchJSON('/status')];
                case 3:
                    runtimeStatus = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _d.sent();
                    runtimeStatus = null;
                    return [3 /*break*/, 5];
                case 5:
                    _d.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, fetchJSON('/gpu-metrics')];
                case 6:
                    gpuMetrics = _d.sent();
                    return [3 /*break*/, 8];
                case 7:
                    _b = _d.sent();
                    gpuMetrics = null;
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, __assign(__assign({}, status), { gpu_status: synthesizeLegacyGpuStatus(gpuMetrics, runtimeStatus), costs: (_c = runtimeStatus === null || runtimeStatus === void 0 ? void 0 : runtimeStatus.costs) !== null && _c !== void 0 ? _c : {} })];
            }
        });
    });
}
function fetchMetrics() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchBackendJSON('/metrics', undefined, { timeoutMs: BACKEND_METADATA_TIMEOUT_MS })];
        });
    });
}
function fetchGpuMetrics() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchJSON('/gpu-metrics')];
        });
    });
}
function fetchTrends(neighborhood) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchJSON("/trends/".concat(encodeURIComponent(neighborhood)))];
        });
    });
}
exports.api = {
    sources: function () { return fetchBackendJSON('/sources', undefined, { timeoutMs: BACKEND_METADATA_TIMEOUT_MS }); },
    geo: function () { return fetchBackendJSON('/geo'); },
    summary: function () { return fetchBackendJSON('/summary', undefined, { timeoutMs: BACKEND_METADATA_TIMEOUT_MS }); },
    neighborhood: function (name, businessType) {
        var qs = businessType ? "?business_type=".concat(encodeURIComponent(businessType)) : '';
        return fetchJSON("/neighborhood/".concat(encodeURIComponent(name)).concat(qs));
    },
    inspections: function (opts) {
        var params = new URLSearchParams();
        if (opts === null || opts === void 0 ? void 0 : opts.neighborhood)
            params.set('neighborhood', opts.neighborhood);
        if (opts === null || opts === void 0 ? void 0 : opts.result)
            params.set('result', opts.result);
        var qs = params.toString();
        return fetchBackendJSON("/inspections".concat(qs ? "?".concat(qs) : ''));
    },
    permits: function (neighborhood) {
        var qs = neighborhood ? "?neighborhood=".concat(encodeURIComponent(neighborhood)) : '';
        return fetchBackendJSON("/permits".concat(qs));
    },
    licenses: function (neighborhood) {
        var qs = neighborhood ? "?neighborhood=".concat(encodeURIComponent(neighborhood)) : '';
        return fetchBackendJSON("/licenses".concat(qs));
    },
    news: function () { return fetchBackendJSON('/news'); },
    politics: function () { return fetchBackendJSON('/politics'); },
    graphFull: function () { return __awaiter(void 0, void 0, void 0, function () {
        var url, res, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "".concat(exports.API_BASE, "/graph/full");
                    console.log('[api.graphFull] GET', url);
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    res = _a.sent();
                    return [4 /*yield*/, res.text()];
                case 2:
                    text = _a.sent();
                    console.log('[api.graphFull] status', res.status, 'nodes:', text.includes('"nodes"') ? 'yes' : 'no');
                    if (!res.ok)
                        throw new Error("API error ".concat(res.status, ": ").concat(text));
                    return [2 /*return*/, JSON.parse(text)];
            }
        });
    }); },
    graph: function (opts) { return __awaiter(void 0, void 0, void 0, function () {
        var params, qs, path, url, res, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    params = new URLSearchParams();
                    if (opts === null || opts === void 0 ? void 0 : opts.page)
                        params.set('page', String(opts.page));
                    if (opts === null || opts === void 0 ? void 0 : opts.limit)
                        params.set('limit', String(opts.limit));
                    qs = params.toString();
                    path = "/graph".concat(qs ? "?".concat(qs) : '');
                    url = "".concat(exports.API_BASE).concat(path);
                    console.log('[api.graph] GET', url);
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    res = _a.sent();
                    return [4 /*yield*/, res.text()];
                case 2:
                    text = _a.sent();
                    console.log('[api.graph] status', res.status, 'body length', text.length, 'body preview', text.slice(0, 200));
                    if (!res.ok) {
                        throw new Error("API error ".concat(res.status, ": ").concat(text));
                    }
                    try {
                        return [2 /*return*/, JSON.parse(text)];
                    }
                    catch (_b) {
                        console.error('[api.graph] Invalid JSON:', text.slice(0, 500));
                        throw new Error('Invalid JSON response from /graph');
                    }
                    return [2 /*return*/];
            }
        });
    }); },
    getUserProfile: function () { return fetchBackendJSON('/user/profile', withLocalUserId()); },
    updateUserProfile: function (businessType, neighborhood, riskTolerance) {
        return fetchBackendJSON('/user/profile', withLocalUserId({
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                business_type: businessType,
                neighborhood: neighborhood,
                risk_tolerance: riskTolerance,
            }),
        }));
    },
    getUserQueries: function (limit) {
        if (limit === void 0) { limit = 10; }
        return fetchBackendJSON("/user/queries?limit=".concat(limit), withLocalUserId());
    },
    createUserQuery: function (payload) {
        return fetchBackendJSON('/user/queries', withLocalUserId({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }));
    },
    cctvFrameUrl: function (cameraId) {
        return "".concat(exports.API_BASE, "/cctv/frame/").concat(encodeURIComponent(cameraId));
    },
    cctvTimeseries: function (neighborhood) {
        return fetchJSON("/cctv/timeseries/".concat(encodeURIComponent(neighborhood)));
    },
    streetscape: function (neighborhood) {
        return fetchJSON("/vision/streetscape/".concat(encodeURIComponent(neighborhood)));
    },
    visionAssess: function (neighborhood) {
        return fetchJSON("/vision/assess/".concat(encodeURIComponent(neighborhood)));
    },
    parkingLatest: function () {
        return fetchJSON('/parking/latest');
    },
    parking: function (neighborhood) {
        return fetchJSON("/parking/".concat(encodeURIComponent(neighborhood)));
    },
    parkingAnnotatedUrl: function (neighborhood) {
        return "".concat(exports.API_BASE, "/parking/annotated/").concat(encodeURIComponent(neighborhood));
    },
    socialTrends: function (neighborhood, businessType) {
        var qs = businessType ? "?business_type=".concat(encodeURIComponent(businessType)) : '';
        return fetchJSON("/social-trends/".concat(encodeURIComponent(neighborhood)).concat(qs));
    },
};
function fetchCityGraph() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchJSON('/graph/full')];
        });
    });
}
function fetchNeighborhoodGraph(neighborhood) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchJSON("/graph/neighborhood/".concat(encodeURIComponent(neighborhood)))];
        });
    });
}
function fetchUserMemories(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchJSON("/user/memories?user_id=".concat(encodeURIComponent(userId)))];
        });
    });
}
