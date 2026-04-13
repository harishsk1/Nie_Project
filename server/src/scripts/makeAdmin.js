"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
const crypto_1 = require("../utils/crypto");
const constants_1 = require("../constants");
/**
 * Script to create or update a user to admin
 * Usage: npx ts-node src/scripts/makeAdmin.ts
 */
async function makeAdmin() {
    const username = "yash";
    const email = "yash@gmail.com";
    const password = "Yash@#1996";
    try {
        // Try to find user by username or email
        let user = await prisma_1.prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email },
                ],
            },
        });
        if (!user) {
            // User doesn't exist, create new admin user
            console.log(`👤 User not found. Creating new admin user...`);
            const hashedPassword = await (0, crypto_1.hashPassword)(password);
            user = await prisma_1.prisma.user.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    role: constants_1.UserRolesEnum.ADMIN,
                    loginType: constants_1.UserLoginType.EMAIL_PASSWORD,
                    isEmailVerified: true, // Set to true so user can log in immediately
                },
            });
            console.log("✅ Admin user created successfully!");
        }
        else {
            // User exists, update role to ADMIN
            console.log(`👤 User found. Updating role to ADMIN...`);
            user = await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { role: constants_1.UserRolesEnum.ADMIN },
            });
            console.log("✅ User role updated to ADMIN successfully!");
        }
        console.log(`\n📋 User Details:`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`\n🔐 Login Credentials:`);
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`\n✨ You can now log in as admin!`);
    }
    catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
makeAdmin();
