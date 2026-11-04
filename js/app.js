import { db, auth, functions } from "./firebase-config.js";

import { httpsCallable } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const APPLICATIONS = "applications";
const ADMINS = "admins";

const $ = id => document.getElementById(id);

const money = value =>
  "₹" + Number(value || 0).toLocaleString("en-IN");

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const dateText = value => {
  if (!value) return "—";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString("en-IN");
};

function toast(message) {
  const element = $("hsToast");
  if (!element) {
    alert(message);
    return;
  }

  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => element.classList.remove("show"),
    3200
  );
}

// Create a hard-to-guess application ID.
function generateApplicationId() {
  const random = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase();

  return "HS" + random;
}

// CUSTOMER: save enquiry to Firestore.
async function submitCustomerEnquiry(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const name = $("fullName").value.trim();
  const mobile = $("mobile").value.trim();
  const email = $("email").value.trim();
  const loanType = $("loanType").value;
  const amount = Number($("loanAmount").value);
  const purpose = $("purpose").value.trim();

  if (!/^[0-9]{10}$/.test(mobile)) {
    toast("Enter a valid 10-digit mobile number.");
    return;
  }

  if (!Number.isFinite(amount) || amount < 1000) {
    toast("Enter a valid application amount.");
    return;
  }

  const button = form.querySelector('[type="submit"]');
  if (button) button.disabled = true;

  try {
    const id = generateApplicationId();

    await setDoc(doc(db, APPLICATIONS, id), {
      applicationId: id,
      name,
      mobile,
      email,
      loanType,
      amount,
      purpose,
      status: "Pending",
      createdAt: serverTimestamp()
    });

    form.reset();

    const result = $("privateTrackResult");
    if (result) {
      result.hidden = false;
      result.textContent =
        `Your enquiry was submitted. Application ID: ${id}. Please save this ID.`;
    }

    if ($("trackApplicationId")) {
      $("trackApplicationId").value = id;
    }

    if ($("trackMobile")) {
      $("trackMobile").value = mobile;
    }

    toast("Enquiry submitted successfully!");
  } catch (error) {
    console.error("Enquiry submission failed:", error);
    toast("Unable to submit enquiry. Please try again.");
  } finally {
    if (button) button.disabled = false;
  }
}

// ADMIN: verify login and admin allowlist.
async function adminLogin(event) {
  event.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  const message = $("adminLoginMessage");

  try {
    message.textContent = "Signing in...";

    const credential = await signInWithEmailAndPassword(
      auth, email, password
    );

    const adminRecord = await getDoc(
      doc(db, ADMINS, credential.user.uid)
    );

    if (!adminRecord.exists()) {
      await signOut(auth);
      message.textContent = "This account is not authorized as an admin.";
      return;
    }

    message.textContent = "Login successful.";
  } catch (error) {
    console.error("Admin login failed:", error);
    message.textContent = "Login failed. Check your email and password.";
  }
}

function setAdminView(isAdmin) {
  const login = $("adminLogin");
  if (login) login.hidden = isAdmin;

  document.querySelectorAll(
    ".main-content > header, .main-content > .stats-grid, " +
    ".main-content > #allApplications, " +
    ".main-content > #quickActions, " +
    ".main-content > .dashboard-footer"
  ).forEach(element => {
    element.hidden = !isAdmin;
  });
}

// ADMIN: fetch applications from Firestore.
async function renderAdmin() {
  const body = $("adminApplications");
  if (!body) return;

  body.innerHTML =
    '<tr><td colspan="7">Loading applications...</td></tr>';

  try {
    const snapshot = await getDocs(
      query(collection(db, APPLICATIONS), orderBy("createdAt", "desc"))
    );

    const all = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    const search = ($("searchInput")?.value || "").toLowerCase();
    const filter = $("statusFilter")?.value || "All";

    const apps = all.filter(app => {
      const matchesStatus =
        filter === "All" || app.status === filter;

      const matchesSearch = [
        app.id, app.name, app.mobile, app.email, app.loanType
      ].some(value =>
        String(value || "").toLowerCase().includes(search)
      );

      return matchesStatus && matchesSearch;
    });

    if ($("adminTotal")) $("adminTotal").textContent = all.length;
    if ($("adminPending")) {
      $("adminPending").textContent =
        all.filter(a => a.status === "Pending").length;
    }
    if ($("adminApproved")) {
      $("adminApproved").textContent =
        all.filter(a => a.status === "Approved").length;
    }
    if ($("adminRejected")) {
      $("adminRejected").textContent =
        all.filter(a => a.status === "Rejected").length;
    }
    if ($("adminUnderReview")) {
      $("adminUnderReview").textContent =
        all.filter(a => a.status === "Under Review").length;
    }

    body.innerHTML = apps.length ? apps.map(app => `
      <tr>
        <td><b>${escapeHTML(app.id)}</b></td>
        <td>
          ${escapeHTML(app.name)}
          <br>${escapeHTML(app.mobile)}
          <br>${escapeHTML(app.email || "")}
        </td>
        <td>${escapeHTML(app.loanType)}</td>
        <td>${money(app.amount)}</td>
        <td>${dateText(app.createdAt)}</td>
        <td>${escapeHTML(app.status)}</td>
        <td>
          <select class="action-select"
                  data-status-id="${escapeHTML(app.id)}">
            ${["Pending", "Under Review", "Approved", "Rejected"]
              .map(status => `
                <option value="${status}"
                  ${app.status === status ? "selected" : ""}>
                  ${status}
                </option>
              `).join("")}
          </select>
        </td>
      </tr>
    `).join("") : `
      <tr><td colspan="7" class="empty">
        No matching applications found.
      </td></tr>
    `;

  } catch (error) {
    console.error("Could not load applications:", error);
    body.innerHTML =
      '<tr><td colspan="7">Could not load applications. Check Firestore rules.</td></tr>';
  }
}

// ADMIN: update application status.
async function updateApplicationStatus(event) {
  const id = event.target.dataset.statusId;
  if (!id) return;

  try {
    await updateDoc(doc(db, APPLICATIONS, id), {
      status: event.target.value,
      updatedAt: serverTimestamp()
    });

    toast("Application status updated.");
    await renderAdmin();
  } catch (error) {
    console.error("Status update failed:", error);
    toast("Could not update status.");
  }
}

// ADMIN: export currently loaded Firestore records.
async function exportApplications() {
  try {
    const snapshot = await getDocs(collection(db, APPLICATIONS));

    const rows = [
      ["Application ID", "Name", "Mobile", "Email",
       "Loan Type", "Amount", "Purpose", "Status", "Date"],
      ...snapshot.docs.map(item => {
        const app = item.data();
        return [
          item.id, app.name, app.mobile, app.email,
          app.loanType, app.amount, app.purpose,
          app.status, dateText(app.createdAt)
        ];
      })
    ];

    const csv = rows.map(row =>
      row.map(value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"'
      ).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "HomeSarthee-Applications.csv";
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    toast("Export failed.");
  }
}

// CUSTOMER TRACKER: secure Cloud Function will be added next.
// Do not query the applications collection from the public browser.

async function trackCustomerApplication(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const result = $("privateTrackResult");

  if (!result) return;

  const applicationId = $("trackApplicationId")?.value.trim();
  const mobile = $("trackMobile")?.value.trim();

  if (!applicationId || !/^[0-9]{10}$/.test(mobile || "")) {
    result.hidden = false;
    result.textContent =
      "Enter a valid Application ID and 10-digit mobile number.";
    return;
  }

  const button = form.querySelector('[type="submit"]');

  if (button) button.disabled = true;

  result.hidden = false;
  result.textContent = "Checking your application...";

  try {
    const trackApplication = httpsCallable(
      functions,
      "trackApplication"
    );

    const response = await trackApplication({
      applicationId,
      mobile
    });

    const app = response.data;

    result.textContent =
      `Application ID: ${app.applicationId}\n` +
      `Loan Type: ${app.loanType}\n` +
      `Status: ${app.status}\n` +
      `Submitted: ${app.createdAt
        ? new Date(app.createdAt).toLocaleDateString("en-IN")
        : "Not available"}`;

    result.style.whiteSpace = "pre-line";

  } catch (error) {
    console.error("Tracking failed:", error);

    if (error.code === "functions/not-found") {
      result.textContent =
        "Application not found. Check your Application ID and mobile number.";
    } else if (error.code === "functions/invalid-argument") {
      result.textContent =
        "Please enter valid application details.";
    } else {
      result.textContent =
        "Unable to track your application. Please try again later.";
    }

  } finally {
    if (button) button.disabled = false;
  }
}

// Initialize page features.
document.addEventListener("DOMContentLoaded", () => {
  $("loanForm")?.addEventListener("submit", submitCustomerEnquiry);
  $("privateTrackForm")?.addEventListener(
    "submit", trackCustomerApplication
  );

  $("adminLoginForm")?.addEventListener("submit", adminLogin);

  $("searchInput")?.addEventListener("input", renderAdmin);
  $("statusFilter")?.addEventListener("change", renderAdmin);
  $("refreshBtn")?.addEventListener("click", renderAdmin);

  $("adminApplications")?.addEventListener(
    "change", updateApplicationStatus
  );

  $("exportBtn")?.addEventListener("click", exportApplications);

  onAuthStateChanged(auth, async user => {
    if (!$("adminLogin")) return;

    if (!user) {
      setAdminView(false);
      return;
    }

    try {
      const adminRecord = await getDoc(doc(db, ADMINS, user.uid));

      if (!adminRecord.exists()) {
        await signOut(auth);
        setAdminView(false);
        return;
      }

      setAdminView(true);
      await renderAdmin();
    } catch (error) {
      console.error("Admin verification failed:", error);
      await signOut(auth);
      setAdminView(false);
    }
  });

  // Loan category selection.
  document.querySelectorAll("[data-loan]").forEach(button => {
    button.addEventListener("click", () => {
      if ($("loanType")) $("loanType").value = button.dataset.loan;

      document.querySelectorAll(".hs-loan-card")
        .forEach(card => card.classList.remove("is-selected"));

      button.closest(".hs-loan-card")
        ?.classList.add("is-selected");

      $("apply")?.scrollIntoView({ behavior: "smooth" });
    });
  });
});