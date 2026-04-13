import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  forgotPasswordRequest,
  resetForgottenPassword,
  changeCurrentPassword,
  refreshAccessToken, // optional
  assignRole,
  getAllUsers,
  deleteUser,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", requireAuth, logoutUser);
router.get("/me", requireAuth, getCurrentUser);
router.post("/forgot-password", forgotPasswordRequest);
router.post("/reset-password/:resetToken", resetForgottenPassword);
router.post("/change-password", requireAuth, changeCurrentPassword);
router.post("/refresh", refreshAccessToken);

// Admin-only routes
router.get("/all", requireAuth, requireAdmin, getAllUsers);
router.post("/:userId", requireAuth, requireAdmin, assignRole);
router.delete("/:userId", requireAuth, requireAdmin, deleteUser);

export default router;
