import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import emailjs from '@emailjs/browser';

emailjs.init('yQ8skMDEGxmHl4fgX');

const Login = () => {
  const videoRef = useRef();
  const [status, setStatus] = useState("Initializing face recognition...");
  const [loading, setLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDirection, setCurrentDirection] = useState("center");
  const intervalRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const directionIntervalRef = useRef(null);
  const matcherRef = useRef(null);
  const userMapRef = useRef({});
  const directions = ["left", "right", "up", "down", "center"];
  const directionIndexRef = useRef(0);
  const streamRef = useRef(null);

  const clearScanning = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (directionIntervalRef.current) {
      clearInterval(directionIntervalRef.current);
      directionIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      return true;
    } catch (err) {
      console.error("Camera error:", err);
      throw new Error("Failed to access camera");
    }
  };

  const sendVerificationCode = async (email, fullName) => {
    try {
      clearScanning();
      stopCamera();
      
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      await emailjs.send(
        'service_uh90vsr',
        'template_ssada75', 
        {
          passcode: code,
          time: '15 minutes',
          email: email,
          app_name: 'BIO TRACK'
        }
      );

      localStorage.setItem("tempVerificationCode", code);
      localStorage.setItem("tempVerificationEmail", email);
      
      return code;
    } catch (error) {
      console.error("Email send error:", error);
      throw new Error("Failed to send verification email");
    }
  };

  const verifyCode = async (userData, fullName, redirectPath) => {
    try {
      const code = await sendVerificationCode(userData.email, fullName);
      
      const { value: enteredCode } = await Swal.fire({
        title: "Verify Your Email",
        html: `
          <div class="text-left">
            <p class="mb-2">Code sent to <strong>${userData.email}</strong></p>
            <p class="text-sm text-gray-600 mb-4">Check your inbox for the 6-digit code</p>
          </div>
        `,
        input: "text",
        inputPlaceholder: "Enter 6-digit code",
        inputAttributes: { maxlength: 6, inputmode: "numeric" },
        showCancelButton: true,
        confirmButtonText: "Verify",
        confirmButtonColor: "#10b981",
        preConfirm: (code) => {
          if (!code || code.length !== 6) {
            Swal.showValidationMessage("Enter a valid 6-digit code");
          }
          return code;
        }
      });

      if (enteredCode) {
        const storedCode = localStorage.getItem("tempVerificationCode");
        const storedEmail = localStorage.getItem("tempVerificationEmail");
        
        if (enteredCode === storedCode && storedEmail === userData.email) {
          // Clear temporary verification items
          localStorage.removeItem("tempVerificationCode");
          localStorage.removeItem("tempVerificationEmail");
          
          // Store user session data (following Code 1's approach)
          const userToStore = {
            ...userData,
            fullName,
            id: userData.studentId || userData.email,
            docId: userData.docId,
          };

          localStorage.setItem("user", JSON.stringify(userToStore));
          localStorage.setItem("userDocId", userData.docId);
          localStorage.setItem("currentUserId", userData.uid || userData.docId);

          if (userData.role === "student" && userData.studentId) {
            localStorage.setItem("studentId", userData.studentId);
          }

          await Swal.fire({
            icon: "success",
            title: `Welcome, ${fullName}`,
            text: "Redirecting to dashboard...",
            timer: 2000,
            showConfirmButton: false,
            didClose: () => {
              window.location.href = redirectPath;
            },
          });
        } else {
          throw new Error("Invalid verification code");
        }
      } else {
        await startCamera();
        startScanning();
      }
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Verification Failed",
        text: error.message,
        confirmButtonColor: "#10b981",
      });
      await startCamera();
      startScanning();
    }
  };

  const changeDirection = () => {
    directionIndexRef.current = (directionIndexRef.current + 1) % directions.length;
    setCurrentDirection(directions[directionIndexRef.current]);
    
    if (directionIndexRef.current === directions.length - 1) {
      setTimeout(() => setCurrentDirection("center"), 2000);
    }
  };

  const startScanning = () => {
    if (isScanning) return;

    setShowRetry(false);
    setStatus("Scanning for faces...");
    setIsScanning(true);
    setProgress(0);
    setCurrentDirection("center");
    directionIndexRef.current = 0;

    directionIntervalRef.current = setInterval(changeDirection, 2000);
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => prev >= 100 ? 100 : prev + 10);
    }, 1000);

    intervalRef.current = setInterval(async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          clearInterval(progressIntervalRef.current);
          clearInterval(directionIntervalRef.current);
          setProgress(100);
          
          const match = matcherRef.current.findBestMatch(detection.descriptor);
          setStatus(`Recognized: ${match.label}`);

          if (match.label !== "unknown") {
            const userData = userMapRef.current[match.label];
            const redirectPath = userData.role === "admin" ? "/admin/dashboard" 
                             : userData.role === "teacher" ? "/teacher/dashboard" 
                             : "/student/dashboard";

            const fullName = `${userData.firstName} ${userData.middleInitial ? userData.middleInitial + " " : ""}${userData.lastName}`;
            await verifyCode(userData, fullName, redirectPath);
          } else {
            clearScanning();
            setShowRetry(true);
            setStatus("Face not recognized");
            await Swal.fire({
              icon: "error",
              title: "Not Recognized",
              text: "No matching user found",
              confirmButtonColor: "#10b981",
            });
          }
        }
      } catch (err) {
        console.error("Scan error:", err);
        clearScanning();
        setShowRetry(true);
        setStatus("Detection error");
      }
    }, 10000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setStatus("Loading models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models/tiny_face_detector_model"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models/face_landmark_68_model"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models/face_recognition_model"),
        ]);

        setStatus("Accessing camera...");
        await startCamera();

        setStatus("Loading user data...");
        const snapshot = await getDocs(collection(db, "users"));
        const labeledDescriptors = [];
        const userMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (Array.isArray(data.descriptor)) {
            const descriptor = new Float32Array(data.descriptor);
            const label = data.studentId || data.email;
            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, [descriptor]));
            userMap[label] = {
              ...data,
              id: label,
              docId: doc.id,
              uid: data.uid || doc.id,
            };
          }
        });

        if (labeledDescriptors.length === 0) {
          setStatus("No users found");
          setLoading(false);
          return;
        }

        matcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.3);
        userMapRef.current = userMap;

        setLoading(false);
        setStatus("Ready for recognition");
        startScanning();
      } catch (err) {
        console.error("Init error:", err);
        setStatus("Initialization failed");
        setLoading(false);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to initialize camera or models",
          confirmButtonColor: "#10b981",
        });
      }
    };

    init();

    return () => {
      clearScanning();
      stopCamera();
    };
  }, []);

  const getDirectionInstruction = () => {
    switch (currentDirection) {
      case "left": return "Turn head left";
      case "right": return "Turn head right"; 
      case "up": return "Look up";
      case "down": return "Look down";
      default: return "Look straight";
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-gradient-to-br from-emerald-900 to-emerald-700 p-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">BIO TRACK</h1>
        <p className="text-emerald-200">Secure face recognition login</p>
      </div>

      <div className="relative w-full max-w-md">
        <div className="relative w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden border-4 border-emerald-400 shadow-xl">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            className="w-full h-full object-cover" 
            playsInline
          />
          
          {isScanning && currentDirection !== "center" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-white text-xl font-bold bg-black/50 px-4 py-2 rounded-lg animate-pulse">
                {currentDirection.toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {isScanning && (
          <>
            <div className="absolute -inset-4 flex items-center justify-center pointer-events-none">
              <div className="h-88 w-88 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
            </div>
            <div className="absolute -bottom-6 left-0 right-0 h-2 bg-emerald-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center mt-6 space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-emerald-300 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-center text-emerald-200 animate-pulse">{status}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 w-full max-w-md space-y-4">
            <div className="bg-emerald-800/50 backdrop-blur-sm rounded-lg p-4 shadow">
              <p className="text-center text-emerald-100 font-medium">
                {isScanning ? getDirectionInstruction() : status}
              </p>
            </div>

            {showRetry && (
              <button
                onClick={startScanning}
                disabled={isScanning}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition-all duration-300"
              >
                {isScanning ? "Scanning..." : "Try Again"}
              </button>
            )}
          </div>

          <div className="mt-4 text-center text-white text-sm">
            <p className="mb-2">Don't have an account?</p>
            <a 
              href="/signup" 
              className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-lg transition-colors duration-300"
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
        </>
      )}
    </div>
  );
};

export default Login;