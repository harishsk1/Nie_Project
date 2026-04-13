"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserLoginType = exports.UserRolesEnum = void 0;
var UserRolesEnum;
(function (UserRolesEnum) {
    UserRolesEnum["USER"] = "USER";
    UserRolesEnum["ADMIN"] = "ADMIN";
})(UserRolesEnum || (exports.UserRolesEnum = UserRolesEnum = {}));
var UserLoginType;
(function (UserLoginType) {
    UserLoginType["EMAIL_PASSWORD"] = "EMAIL_PASSWORD";
    UserLoginType["GOOGLE"] = "GOOGLE";
    UserLoginType["GITHUB"] = "GITHUB";
})(UserLoginType || (exports.UserLoginType = UserLoginType = {}));
