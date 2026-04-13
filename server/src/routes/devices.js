"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deviceController_1 = require("../controllers/deviceController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All device routes require authentication
router.use(auth_1.requireAuth);
// GET    /api/devices
router.get("/", deviceController_1.DeviceController.getAll);
// GET    /api/devices/:id
router.get("/:id", deviceController_1.DeviceController.getById);
// POST   /api/devices
router.post("/", deviceController_1.DeviceController.create);
// PUT    /api/devices/:id
router.put("/:id", deviceController_1.DeviceController.update);
// DELETE /api/devices/:id
router.delete("/:id", deviceController_1.DeviceController.delete);
// GET /api/devices/:id/parameters - Get parameters for a device
router.get("/:id/parameters", deviceController_1.DeviceController.getParameters);
// POST /api/devices/:id/parameters - Add a parameter to a device
router.post("/:id/parameters", deviceController_1.DeviceController.addParameter);
// DELETE /api/devices/:id/parameters?name=xxx&unit=yyy - Remove a parameter from a device
router.delete("/:id/parameters", deviceController_1.DeviceController.removeParameter);
exports.default = router;
