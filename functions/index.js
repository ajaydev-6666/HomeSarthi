
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

exports.trackApplication = onCall(
  {
    region: "asia-south1",
    maxInstances: 10
  },
  async (request) => {
    try {
      const { applicationId, mobile } = request.data || {};

      // Validate input
      if (
        typeof applicationId !== "string" ||
        typeof mobile !== "string"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Application ID and mobile number are required."
        );
      }

      const id = applicationId.trim().toUpperCase();
      const phone = mobile.replace(/\D/g, "");

      if (!id || !/^[0-9]{10}$/.test(phone)) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid Application ID and 10-digit mobile number."
        );
      }

      // Find application
      const applicationRef = db.collection("applications").doc(id);
      const snapshot = await applicationRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Application not found. Please check your details."
        );
      }

      const data = snapshot.data();

      // Verify registered mobile number
      const savedMobile = String(data.mobile || "").replace(/\D/g, "");

      if (savedMobile !== phone) {
        throw new HttpsError(
          "not-found",
          "Application not found. Please check your details."
        );
      }

      // Return only customer-safe information
      return {
        applicationId: snapshot.id,
        loanType: data.loanType || "",
        status: data.status || "Pending",
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null
      };

    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("Application tracking error:", error);

      throw new HttpsError(
        "internal",
        "Unable to track your application right now."
      );
    }
  }
);
