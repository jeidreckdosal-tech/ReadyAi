const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

const PROJECT_ID = "demo-no-project";
const DATABASE_ID = "ai-studio-android-readyai-866099a5-902b-4fe9-94e9-f6647af9c270";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules: fs.readFileSync("firestore.rules", "utf8"),
      database: DATABASE_ID,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user cannot read or write user profiles", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore({ databaseId: DATABASE_ID });
  await assertFails(unauthDb.collection("users").doc("alice").get());
  await assertFails(
    unauthDb.collection("users").doc("alice").set({
      userId: "alice",
      email: "alice@example.com",
      displayName: "Alice",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );
});

test("Authenticated user can create and read own profile", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore({ databaseId: DATABASE_ID });
  const profileRef = aliceDb.collection("users").doc("alice");

  await assertSucceeds(
    profileRef.set({
      userId: "alice",
      email: "alice@example.com",
      displayName: "Alice Reyes",
      phone: "+639123456789",
      bloodType: "O+",
      regionCode: "NCR",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  await assertSucceeds(profileRef.get());
});

test("User cannot read or overwrite another user's profile", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore({ databaseId: DATABASE_ID });
  const bobDb = testEnv.authenticatedContext("bob").firestore({ databaseId: DATABASE_ID });

  await assertSucceeds(
    aliceDb.collection("users").doc("alice").set({
      userId: "alice",
      email: "alice@example.com",
      displayName: "Alice Reyes",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  // Bob trying to read Alice's profile
  await assertFails(bobDb.collection("users").doc("alice").get());

  // Bob trying to write Alice's profile
  await assertFails(
    bobDb.collection("users").doc("alice").set({
      userId: "alice",
      email: "bob@example.com",
      displayName: "Bob",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );
});

test("User can create and list own checklist items, but cannot access others'", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore({ databaseId: DATABASE_ID });
  const bobDb = testEnv.authenticatedContext("bob").firestore({ databaseId: DATABASE_ID });

  const aliceItemRef = aliceDb.collection("users").doc("alice").collection("checklist_items").doc("item1");
  await assertSucceeds(
    aliceItemRef.set({
      id: "item1",
      userId: "alice",
      title: "Flashlight & Extra Batteries",
      category: "Tools",
      description: "Waterproof LED flashlight",
      isChecked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  // Alice can read & list
  await assertSucceeds(aliceItemRef.get());
  await assertSucceeds(aliceDb.collection("users").doc("alice").collection("checklist_items").get());

  // Bob cannot read Alice's checklist item
  await assertFails(bobDb.collection("users").doc("alice").collection("checklist_items").doc("item1").get());
  await assertFails(bobDb.collection("users").doc("alice").collection("checklist_items").get());
});

test("User can submit feedback and read own feedback", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore({ databaseId: DATABASE_ID });
  const bobDb = testEnv.authenticatedContext("bob").firestore({ databaseId: DATABASE_ID });

  const feedbackRef = aliceDb.collection("feedback").doc("fb1");
  await assertSucceeds(
    feedbackRef.set({
      id: "fb1",
      userId: "alice",
      userName: "Alice",
      category: "Bagyo",
      message: "Evacuation route in Barangay 1 is clear.",
      rating: 5,
      createdAt: new Date(),
    })
  );

  const androidFeedbackRef = aliceDb.collection("feedback").doc("fb_test_123");
  await assertSucceeds(
    androidFeedbackRef.set({
      id: "fb_test_123",
      userId: "alice",
      userName: "Maria Santos",
      category: "Baha",
      message: "Flood subsided in area.",
      rating: 5,
      createdAt: new Date(),
    })
  );

  await assertSucceeds(feedbackRef.get());

  // Bob cannot read Alice's feedback
  await assertFails(bobDb.collection("feedback").doc("fb1").get());
});

test("Authenticated user can publish and observe disaster alerts", async () => {
  const aliceDb = testEnv.authenticatedContext("alice").firestore({ databaseId: DATABASE_ID });
  const unauthDb = testEnv.unauthenticatedContext().firestore({ databaseId: DATABASE_ID });

  const alertRef = aliceDb.collection("alerts").doc("alert_test_1");
  await assertSucceeds(
    alertRef.set({
      id: "alert_test_1",
      userId: "alice",
      title: "🚨 [TEST ALERT] Flash Flood Warning",
      category: "BAHA",
      severity: "CRITICAL",
      message: "This is a test disaster alert to verify cloud Firestore data popup.",
      locationCity: "Quezon City",
      sourceAgency: "PAGASA",
      isTest: true,
      createdAt: new Date(),
    })
  );

  // Authenticated user can read alerts
  await assertSucceeds(alertRef.get());
  await assertSucceeds(aliceDb.collection("alerts").get());

  // Unauthenticated user cannot read alerts
  await assertFails(unauthDb.collection("alerts").doc("alert_test_1").get());
});

