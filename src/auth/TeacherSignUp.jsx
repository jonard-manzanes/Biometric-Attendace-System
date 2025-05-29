import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const TeacherSignUp = () => {
  const navigate = useNavigate();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Initializing camera...");
  const [isLoading, setIsLoading] = useState(false);
  const role = "teacher";
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuthorization = async () => {
      try {
        const code = sessionStorage.getItem("teacher-invite");
        if (code !== "granted") {
          await Swal.fire({
            icon: "warning",
            title: "Unauthorized",
            text: "You are not allowed to access this page.",
            confirmButtonColor: "#10b981",
          });
          navigate("/signup");
          return;
        }
        setLoading(false);
      } catch (error) {
        console.error("Authorization error:", error);
        navigate("/signup");
      }
    };

    verifyAuthorization();
  }, [navigate]);

  useEffect(() => {
    if (loading) return;

    const initModelsAndVideo = async () => {
      try {
        setStatus("Loading face recognition models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(
            "/models/tiny_face_detector_model"
          ),
          faceapi.nets.faceLandmark68Net.loadFromUri(
            "/models/face_landmark_68_model"
          ),
          faceapi.nets.faceRecognitionNet.loadFromUri(
            "/models/face_recognition_model"
          ),
        ]);

        setStatus("Accessing camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        videoRef.current.srcObject = stream;
        setStatus("Ready for registration");
      } catch (error) {
        setStatus("Failed to initialize camera or load models.");
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "Camera Access Required",
          text: "Please enable camera access to continue with face registration.",
          confirmButtonColor: "#10b981",
        });
      }
    };

    initModelsAndVideo();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [loading]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push("at least 8 characters");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("one number");
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("one special character");
    }
    return errors;
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg");
  };

  const checkIfEmployeeExists = async (employeeId) => {
    const q = query(
      collection(db, "users"),
      where("studentId", "==", employeeId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : querySnapshot.docs[0];
  };

  const checkIfFaceExists = async (descriptor) => {
    const q = query(collection(db, "users"), where("descriptor", "!=", null));
    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
      const existingDescriptor = doc.data().descriptor;
      const distance = faceapi.euclideanDistance(
        descriptor,
        existingDescriptor
      );
      if (distance < 0.3) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      Swal.fire({
        icon: "error",
        title: "Password Requirements Not Met",
        html: `
          <div class="text-left">
            <p class="mb-2">Your password must contain:</p>
            <ul class="list-disc list-inside">
              ${passwordErrors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </div>
        `,
        confirmButtonColor: "#10b981",
      });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Password Mismatch",
        text: "The passwords you entered do not match.",
        confirmButtonColor: "#10b981",
      });
      setIsLoading(false);
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !employeeId.trim() || !email.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please fill in all the required fields.",
        confirmButtonColor: "#10b981",
      });
      setIsLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    setStatus("Detecting face...");
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error("No face detected. Please ensure your face is visible and well-lit.");
      }

      const descriptor = Array.from(detection.descriptor);
      const faceExists = await checkIfFaceExists(descriptor);
      if (faceExists) {
        throw new Error("This face has already been registered in our system.");
      }

      const snapshot = captureSnapshot();
      const existingEmployeeDoc = await checkIfEmployeeExists(employeeId);

      if (existingEmployeeDoc) {
        const existingEmployee = existingEmployeeDoc.data();
        if (existingEmployee.descriptor?.length > 0) {
          throw new Error("This employee ID is already registered with a face.");
        }

        await updateDoc(doc(db, "users", existingEmployeeDoc.id), {
          descriptor,
          image: snapshot,
          email,
          password,
          updatedAt: serverTimestamp(),
        });

        await Swal.fire({
          icon: "success",
          title: "Registration Complete",
          text: "Your face has been successfully registered to your account.",
          confirmButtonColor: "#10b981",
        });
      } else {
        await addDoc(collection(db, "users"), {
          firstName,
          lastName,
          studentId: employeeId,
          email,
          password,
          role,
          descriptor,
          image: snapshot,
          fullName: `${firstName} ${lastName}`,
          createdAt: serverTimestamp(),
        });

        await Swal.fire({
          icon: "success",
          title: "Registration Successful",
          text: "You have been successfully registered as a teacher.",
          confirmButtonColor: "#10b981",
        });
      }

      setStatus("Registration successful!");
      setFirstName("");
      setLastName("");
      setEmployeeId("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      navigate("/login");
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: error.message,
        confirmButtonColor: "#10b981",
      });
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center">
        <div className="text-white text-xl">Verifying authorization...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl bg-white/5 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left side - Camera Preview */}
          <div className="bg-emerald-900/30 p-6 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-xs aspect-square mb-6">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-full rounded-xl object-cover border-4 border-emerald-400 shadow-lg"
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute inset-0 border-4 border-transparent border-dashed rounded-xl animate-pulse"></div>
              </div>
            </div>
            
            <div className="text-center w-full">
              <p className="text-emerald-100 font-medium bg-emerald-800/50 rounded-lg py-2 px-4">
                {status}
              </p>
              <p className="text-emerald-200 text-sm mt-3">
                Position your face in the center of the frame
              </p>
            </div>
          </div>

          {/* Right side - Registration Form */}
          <div className="bg-white/5 p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-6">
              Teacher Registration
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-emerald-100 mb-1">First Name*</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 mb-1">Last Name*</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-100 mb-1">Employee ID*</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-100 mb-1">Email*</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value && !validateEmail(e.target.value)) {
                      setEmailError("Please enter a valid email address");
                    } else {
                      setEmailError("");
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
                {emailError && (
                  <p className="text-red-400 text-sm mt-1">{emailError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-emerald-100 mb-1">Password*</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 mb-1">Confirm Password*</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="bg-emerald-900/30 p-3 rounded-lg">
                <p className="text-emerald-100 text-sm font-medium">Password Requirements:</p>
                <ul className="text-emerald-200 text-xs list-disc list-inside mt-1">
                  <li>Minimum 8 characters</li>
                  <li>At least 1 uppercase letter</li>
                  <li>At least 1 lowercase letter</li>
                  <li>At least 1 number</li>
                  <li>At least 1 special character</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  isLoading
                    ? "bg-emerald-700 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500"
                } text-white flex items-center justify-center`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Register Now"
                )}
              </button>

              <div className="flex justify-center pt-4 border-t border-emerald-800/50">
                <a href="/login" className="text-emerald-300 hover:text-white text-sm">
                  Already have an account? Login
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSignUp;