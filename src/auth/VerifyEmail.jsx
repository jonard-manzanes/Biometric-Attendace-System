import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, getDoc } from "firebase/firestore";
import Swal from "sweetalert2";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const userId = searchParams.get("userId");
  const navigate = useNavigate();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        if (!token || !userId) throw new Error("Invalid verification link");

        // Check token validity
        const tokensRef = collection(db, "verificationTokens");
        const q = query(tokensRef, where("token", "==", token), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) throw new Error("Invalid or expired verification link");

        const tokenDoc = querySnapshot.docs[0];
        const tokenData = tokenDoc.data();

        if (new Date() > tokenData.expiresAt.toDate()) {
          await deleteDoc(tokenDoc.ref);
          throw new Error("Verification link has expired");
        }

        // Update user's verified status
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { verified: true });
        
        // Delete the used token
        await deleteDoc(tokenDoc.ref);

        // Get user data for success message
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        await Swal.fire({
          icon: "success",
          title: "Account Verified",
          html: `
            <div class="text-left">
              <p class="mb-2">Your Generic Solutions account has been successfully verified.</p>
              <p>You can now log in and access all features.</p>
              <div class="mt-4 p-3 bg-gray-100 rounded text-sm">
                <p class="font-medium">Student ID: ${userData.studentId}</p>
                <p>Registered email: ${userData.email}</p>
              </div>
            </div>
          `,
          confirmButtonColor: "#10b981",
          confirmButtonText: "Continue to Login",
        });

        navigate("/login");
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Verification Failed",
          html: `
            <div class="text-left">
              <p class="mb-3 text-red-600">${error.message}</p>
              <p class="mt-4">Please try registering again or contact support:</p>
              <p class="text-blue-600 font-medium">support@genericsolutions.com</p>
              <div class="mt-3 p-2 bg-gray-100 rounded text-xs">
                <p>Reference: ${token || 'N/A'}</p>
              </div>
            </div>
          `,
          confirmButtonColor: "#10b981",
        });
        navigate("/signup");
      }
    };

    verifyToken();
  }, [token, userId, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center">
      <div className="bg-white/5 backdrop-blur-md rounded-xl p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Verifying your email...</h2>
        <p className="text-emerald-100">Please wait while we verify your email address.</p>
      </div>
    </div>
  );
};

export default VerifyEmail;