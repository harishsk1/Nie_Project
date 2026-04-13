import { Router } from "express";
import { DeviceController } from "../controllers/deviceController";
import { requireAuth } from "../middleware/auth";

const router = Router();

// All device routes require authentication
router.use(requireAuth);

// GET    /api/devices
router.get("/", DeviceController.getAll);

// GET    /api/devices/:id
router.get("/:id", DeviceController.getById);

// POST   /api/devices
router.post("/", DeviceController.create);

// PUT    /api/devices/:id
router.put("/:id", DeviceController.update);

// DELETE /api/devices/:id
router.delete("/:id", DeviceController.delete);

// GET /api/devices/:id/parameters - Get parameters for a device
router.get("/:id/parameters", DeviceController.getParameters);

// POST /api/devices/:id/parameters - Add a parameter to a device
router.post("/:id/parameters", DeviceController.addParameter);

// DELETE /api/devices/:id/parameters?name=xxx&unit=yyy - Remove a parameter from a device
router.delete("/:id/parameters", DeviceController.removeParameter);

export default router;
