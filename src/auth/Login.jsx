import React, { useState } from "react";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

const Login = () => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Enter your credentials");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("Verifying credentials...");

    try {
      if (!email || !role) {
        throw new Error("Please provide both email and role");
      }

      // Query Firestore for user with matching email and role
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", "==", email),
        where("role", "==", role)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("No user found with these credentials");
      }

      // Get the first matching user (should be only one)
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const fullName = `${userData.firstName} ${
        userData.middleInitial ? userData.middleInitial + " " : ""
      }${userData.lastName}`;

      handleSuccessfulLogin(
        {
          ...userData,
          docId: userDoc.id,
        },
        fullName
      );
    } catch (error) {
      setLoading(false);
      setStatus("Login failed");
      Swal.fire({
        icon: "error",
        title: "Login Error",
        text: error.message,
        confirmButtonColor: "#10b981",
      });
    }
  };

const handleSuccessfulLogin = (userData, fullName) => {
  // Determine redirect path based on role
  let redirectPath = "/dashboard";
  if (userData.role === "admin") {  
    redirectPath = "/admin/dashboard";
  } else if (userData.role === "teacher") {
    redirectPath = "/teacher/dashboard";
  } else if (userData.role === "staff") {
    redirectPath = "/staff/dashboard";
  } else {
    redirectPath = "/student/dashboard";
  }

  // Store user data
  const userToStore = {
    ...userData,
    fullName,
    id: userData.studentId || userData.email,
    docId: userData.docId,
  };

  localStorage.setItem("user", JSON.stringify(userToStore));
  localStorage.setItem("userDocId", userData.docId);
  localStorage.setItem("currentUserId", userData.uid || userData.docId);
  
  // Add these lines to store department information
  if (userData.department) {
    localStorage.setItem('studentDepartment', userData.department);
  }
  
  if (userData.role === "student" && userData.studentId) {
    localStorage.setItem("studentId", userData.studentId);
  }

  // Create welcome message with role and department (if student)
  let welcomeMessage = `Welcome, ${fullName}!`;
  let roleMessage = `Role: ${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}`;
  
  if (userData.role === "student" && userData.department) {
    roleMessage += ` (${userData.department})`;
  }

  Swal.fire({
    icon: "success",
    title: welcomeMessage,
    html: `<div class="text-center">
             <p>${roleMessage}</p>
             <p class="mt-2">You're being redirected to your dashboard</p>
           </div>`,
    timer: 2500,
    showConfirmButton: false,
    timerProgressBar: true,
    didClose: () => {
      window.location.href = redirectPath;
    },
  });
};

  return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-gradient-to-br from-emerald-900 to-emerald-700 p-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">BIO TRACK</h1>
        <p className="text-emerald-200">Secure login</p>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-lg">
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-emerald-100 mb-1"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white/20 text-white rounded-lg border border-emerald-300/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-emerald-100 mb-1"
            >
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 bg-white/20 text-white rounded-lg border border-emerald-300/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              required
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400 transition-all duration-300"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-emerald-200">{status}</p>
        </div>
      </div>

      <div className="mt-4 text-center text-white text-sm">
        <p className="mb-2">Don't have an account?</p>
        <a
          className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-lg transition-colors duration-300"
          href="/signup"
        >
          Register Now
        </a>
        <button
          onClick={() => (window.location.href = "/quick-attendance")}
          className="ml-4 inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-lg transition-colors duration-300"
        >
          Quick Attendance
        </button>
      </div>
    </div>
  );
};

export default Login;