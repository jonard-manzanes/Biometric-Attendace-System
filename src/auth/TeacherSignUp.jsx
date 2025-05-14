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
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [loading, setLoading] = useState(true);
  const role = "teacher";

  useEffect(() => {
    const verifyAuthorization = async () => {
      try {
        const code = sessionStorage.getItem("teacher-invite");

        if (code !== "granted") {
          await Swal.fire({
            icon: "warning",
            title: "Unauthorized",
            text: "You are not allowed to access this page.",
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

    let stream = null;

    const initModelsAndVideo = async () => {
      try {
        setStatus("Loading face detection models...");

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
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStatus("Ready for registration - Please face the camera");
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setStatus("Error: " + (error.message || "Failed to initialize"));

        if (error.name === "NotAllowedError") {
          Swal.fire({
            icon: "error",
            title: "Camera Access Denied",
            text: "Please enable camera permissions to continue.",
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Initialization Failed",
            text: "Could not start camera or load face detection models.",
          });
        }
      }
    };

    initModelsAndVideo();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [loading]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return "";
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordError(validatePassword(newPassword));
  };

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    if (newEmail && !validateEmail(newEmail)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
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

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !employeeId.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please fill in all the required fields.",
      });
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (passwordValidation) {
      setPasswordError(passwordValidation);
      return;
    }

    setStatus("Scanning for face...");
    const swalInstance = Swal.fire({
      title: "Face Detection",
      html: `
        <div>
          <p>Please look directly at the camera</p>
          <div class="my-4 h-1 w-full bg-gray-200">
            <div class="h-1 bg-green-500 animate-pulse" style="width: 100%"></div>
          </div>
        </div>
      `,
      allowOutsideClick: false,
      showConfirmButton: false,
    });

    try {
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      await swalInstance.close();

      if (!detection) {
        Swal.fire({
          icon: "error",
          title: "No Face Detected",
          text: "Please ensure your face is visible and well-lit.",
        });
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      const faceExists = await checkIfFaceExists(descriptor);

      if (faceExists) {
        Swal.fire({
          icon: "error",
          title: "Face Already Registered",
          text: "This face has already been registered in our system.",
        });
        return;
      }

      const snapshot = captureSnapshot();
      const existingEmployeeDoc = await checkIfEmployeeExists(employeeId);

      if (existingEmployeeDoc) {
        const userRef = doc(db, "users", existingEmployeeDoc.id);
        await updateDoc(userRef, {
          descriptor,
          image: snapshot,
          email,
          password,
        });

        Swal.fire({
          icon: "success",
          title: "Registration Updated",
          text: "Your face has been successfully registered to your account.",
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

        Swal.fire({
          icon: "success",
          title: "Registration Successful",
          text: "You have been successfully registered as a teacher.",
        });

        navigate("/login");

      }

      setStatus("Registration complete!");


      setFirstName("");
      setLastName("");
      setEmployeeId("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Registration error:", error);
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: error.message || "An error occurred during registration.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-800 flex justify-center items-center">
        <div className="text-white text-xl">Verifying authorization...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-800 flex justify-center items-center px-4">
      <div className="w-full max-w-4xl bg-white/10 p-6 md:p-10 rounded-xl shadow-lg backdrop-blur-2xl">
        <h1 className="text-emerald-200 text-2xl md:text-3xl text-center mb-6 font-bold">
          Teacher Registration
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col">
              <label className="text-white">First Name*</label>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-white">Last Name*</label>
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                required
              />
            </div>
          </div>

          <div className="flex flex-col mb-4">
            <label className="text-white">Employee ID*</label>
            <input
              type="text"
              placeholder="Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              required
            />
          </div>

          <div className="flex flex-col mb-4">
            <label className="text-white">Email*</label>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={handleEmailChange}
              className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              required
            />
            {emailError && (
              <p className="text-red-400 text-sm mt-1">{emailError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col">
              <label className="text-white">Password*</label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={handlePasswordChange}
                className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                required
              />
              {passwordError && (
                <p className="text-red-400 text-sm mt-1">{passwordError}</p>
              )}
            </div>
            <div className="flex flex-col">
              <label className="text-white">Confirm Password*</label>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (password !== e.target.value) {
                    setPasswordError("Passwords do not match");
                  } else {
                    setPasswordError("");
                  }
                }}
                className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                required
              />
            </div>
            <small className="text-gray-300">
              Password must contain: 8+ characters, uppercase, lowercase,
              number, and special character
            </small>
          </div>

          <div className="flex justify-center mb-4">
            <div className="relative w-48 h-48 md:w-64 md:h-64">
              <video
                className="w-full h-full rounded-full border-4 border-green-500 shadow-lg object-cover"
                ref={videoRef}
                autoPlay
                muted
                playsInline
              />
              <canvas
                className="absolute top-0 left-0 w-full h-full rounded-full"
                ref={canvasRef}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <p className="text-center text-white mb-4">{status}</p>

          <div className="mt-3 py-3 text-center bg-emerald-300 rounded-md hover:bg-emerald-400 transition-colors duration-200">
            <button
              type="submit"
              className="text-black font-semibold"
              disabled={
                status.includes("Error") ||
                status.includes("Initializing") ||
                passwordError ||
                emailError
              }
            >
              {status.includes("Error") ? "Fix Errors to Register" : "Register"}
            </button>
          </div>
          <div className="flex justify-between text-emerald-500 mt-2 text-sm">
            <a href="/login">Already registered? Login here</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherSignUp;
