import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/authApi";
import { User } from "../types/auth.types";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Mail,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  X,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { formatDate } from "../utils/dateTime";

const ITEMS_PER_PAGE = 10;

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<"USER" | "ADMIN">("USER");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "USER" as "USER" | "ADMIN",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await authApi.getAllUsers();
      const usersData = response.data || response;
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errors: { username?: string; email?: string; password?: string } = {};

    // Validate username
    if (!createForm.username.trim()) {
      errors.username = "Username is required";
    } else if (createForm.username.trim().length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    // Validate email
    if (!createForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) {
      errors.email = "Please enter a valid email address";
    }

    // Validate password
    if (!createForm.password) {
      errors.password = "Password is required";
    } else if (createForm.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await authApi.register(createForm);
      setShowCreateForm(false);
      setCreateForm({
        username: "",
        email: "",
        password: "",
        role: "USER",
      });
      setFormErrors({});
      setShowPassword(false);
      fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create user");
    }
  };

  const handleUpdateRole = async (userId: string) => {
    try {
      setError("");
      await authApi.assignRole(userId, editingRole);
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update user role");
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (userId === currentUser?.id) {
      setError("You cannot delete your own account");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete user "${username}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError("");
      await authApi.deleteUser(userId);
      fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete user");
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditingRole(user.role);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return users.slice(startIndex, endIndex);
  }, [users, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [users.length, currentPage, totalPages]);

  return (
    <div className="w-full max-w-full mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-5 lg:py-6 space-y-4 sm:space-y-5 lg:space-y-6 overflow-x-hidden box-border">
      {/* Header */}
      <header className="space-y-2 mb-4 sm:mb-5 lg:mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              User Management
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setError("");
              setFormErrors({});
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </header>

      {/* Error Message - Only show when modal is closed */}
      {error && !showCreateForm && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/20 text-destructive border border-destructive/50">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateForm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateForm(false);
              setCreateForm({
                username: "",
                email: "",
                password: "",
                role: "USER",
              });
              setError("");
              setFormErrors({});
              setShowPassword(false);
            }
          }}
        >
          <div 
            className="bg-card rounded-xl border border-border shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Create New User</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a new user to the system
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateForm({
                      username: "",
                      email: "",
                      password: "",
                      role: "USER",
                    });
                    setError("");
                    setFormErrors({});
                    setShowPassword(false);
                  }}
                  className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/20 text-destructive border border-destructive/50">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Username <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, username: e.target.value });
                    if (formErrors.username) setFormErrors({ ...formErrors, username: undefined });
                  }}
                  required
                  className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    formErrors.username ? "border-destructive" : "border-input"
                  }`}
                  placeholder="Enter username"
                />
                {formErrors.username && (
                  <p className="text-xs text-destructive mt-1">{formErrors.username}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, email: e.target.value });
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                  required
                  className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    formErrors.email ? "border-destructive" : "border-input"
                  }`}
                  placeholder="Enter email"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive mt-1">{formErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={createForm.password}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, password: e.target.value });
                      if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                    }}
                    required
                    minLength={6}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                      formErrors.password ? "border-destructive" : "border-input"
                    }`}
                    placeholder="Enter password (min 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="text-xs text-destructive mt-1">{formErrors.password}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      role: e.target.value as "USER" | "ADMIN",
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm({
                    username: "",
                    email: "",
                    password: "",
                    role: "USER",
                  });
                  setError("");
                  setFormErrors({});
                  setShowPassword(false);
                }}
                className="px-6 py-2 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 border border-border rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <Save className="h-4 w-4" />
                Create User
              </button>
            </div>
          </form>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="text-muted-foreground text-base">Loading users...</span>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground align-middle">
                      Username
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground align-middle">
                      Email
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground align-middle">
                      Role
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground align-middle">
                      Created
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground align-middle">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-accent transition-colors"
                    >
                      <td className="px-4 py-3 align-middle text-left">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {user.username}
                          </span>
                          {user.id === currentUser?.id && (
                            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-left">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-left">
                        {editingId === user.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editingRole}
                              onChange={(e) =>
                                setEditingRole(e.target.value as "USER" | "ADMIN")
                              }
                              className="px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                            <button
                              onClick={() => handleUpdateRole(user.id)}
                              className="p-1 hover:bg-accent rounded transition-colors text-primary"
                              title="Save"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.role === "ADMIN"
                                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {user.role}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground align-middle text-left">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          {editingId !== user.id && (
                            <>
                              <button
                                onClick={() => startEdit(user)}
                                className="p-2 hover:bg-accent rounded transition-colors text-primary"
                                title="Edit role"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                disabled={user.id === currentUser?.id}
                                className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  user.id === currentUser?.id
                                    ? "Cannot delete your own account"
                                    : "Delete user"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/50">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, users.length)} of{" "}
                  {users.length} users
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

