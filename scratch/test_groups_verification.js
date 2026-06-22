import { db, conversationsTable, usersTable } from "../lib/db/src/index.ts";
import { eq } from "drizzle-orm";

async function run() {
  try {
    console.log("Checking database connection, groups, and users...");
    
    // Find all group conversations
    const groups = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.type, "group"));

    console.log(`Found ${groups.length} groups in database.`);

    if (groups.length === 0) {
      console.log("No group conversations found in database. Creating a mock group...");
      
      // Let's find a user to be the owner
      const firstUser = await db.query.usersTable.findFirst();
      if (!firstUser) {
        console.error("No users found in database to assign as group owner. Please seed the DB.");
        return;
      }
      
      const [newGroup] = await db
        .insert(conversationsTable)
        .values({
          type: "group",
          name: "Test Group Verified",
          ownerId: firstUser.id,
          isVerified: false,
        })
        .returning();

      console.log("Mock group created:", newGroup);
      groups.push(newGroup);
    }

    const testGroup = groups[0];
    console.log(`Selected group for testing: ID=${testGroup.id}, Name="${testGroup.name}", isVerified=${testGroup.isVerified}`);

    // Toggle verification to true
    console.log("Setting isVerified = true...");
    const [updatedTrue] = await db
      .update(conversationsTable)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(conversationsTable.id, testGroup.id))
      .returning();
    
    console.log("Updated group (true):", {
      id: updatedTrue.id,
      name: updatedTrue.name,
      isVerified: updatedTrue.isVerified,
      inviteCode: updatedTrue.inviteCode,
    });

    if (updatedTrue.isVerified !== true) {
      throw new Error("Failed to update isVerified to true");
    }

    // Toggle verification back to false (or keep it true, but let's toggle back to original)
    console.log("Setting isVerified = false...");
    const [updatedFalse] = await db
      .update(conversationsTable)
      .set({ isVerified: false, updatedAt: new Date() })
      .where(eq(conversationsTable.id, testGroup.id))
      .returning();

    console.log("Updated group (false):", {
      id: updatedFalse.id,
      name: updatedFalse.name,
      isVerified: updatedFalse.isVerified,
    });

    if (updatedFalse.isVerified !== false) {
      throw new Error("Failed to update isVerified to false");
    }

    // Now test user verification
    console.log("Testing user verification status...");
    const users = await db.select().from(usersTable);
    console.log(`Found ${users.length} users in database.`);
    
    if (users.length > 0) {
      const testUser = users[0];
      const initialVerified = testUser.isVerified;
      console.log(`Selected user for testing: ID=${testUser.id}, Username="${testUser.username}", isVerified=${initialVerified}`);

      // Toggle to true
      console.log("Setting user isVerified = true...");
      const [userTrue] = await db
        .update(usersTable)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(usersTable.id, testUser.id))
        .returning();
      
      console.log("Updated user (true):", {
        id: userTrue.id,
        username: userTrue.username,
        isVerified: userTrue.isVerified,
      });

      if (userTrue.isVerified !== true) {
        throw new Error("Failed to update user isVerified to true");
      }

      // Restore original
      console.log(`Restoring user isVerified = ${initialVerified}...`);
      const [userRestored] = await db
        .update(usersTable)
        .set({ isVerified: initialVerified, updatedAt: new Date() })
        .where(eq(usersTable.id, testUser.id))
        .returning();
      
      console.log("Restored user status:", {
        id: userRestored.id,
        username: userRestored.username,
        isVerified: userRestored.isVerified,
      });
    }

    console.log("All database read/write checks (groups & users) passed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Verification script failed:", err);
    process.exit(1);
  }
}

run();
