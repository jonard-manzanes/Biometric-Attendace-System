import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const Login = () => {
  const videoRef = useRef();
  const [status, setStatus] = useState("Initializing face recognition...");
  const [loading, setLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const matcherRef = useRef(null);
  const userMapRef = useRef({});

  const clearScanning = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsScanning(false);
  };

  const verifyPassword = async (userData, fullName, redirectPath) => {
    const { value: password } = await Swal.fire({
      title: "Password Verification",
      text: `Please enter the password for ${fullName}`,
      input: "password",
      inputPlaceholder: "Enter your password",
      inputAttributes: {
        maxlength: 20,
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Verify",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#ef4444",
      showLoaderOnConfirm: true,
      preConfirm: (inputPassword) => {
        if (!inputPassword) {
          Swal.showValidationMessage("Password is required");
        }
        return inputPassword;
      },
      allowOutsideClick: () => !Swal.isLoading(),
      customClass: {
        popup: "rounded-lg shadow-xl",
        confirmButton: "px-4 py-2 rounded-lg",
        cancelButton: "px-4 py-2 rounded-lg",
      },
    });

    if (password) {
      if (password === userData.password) {
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

        Swal.fire({
          icon: "success",
          title: `Welcome, ${fullName}`,
          text: "You're being redirected to your dashboard",
          timer: 2500,
          showConfirmButton: false,
          timerProgressBar: true,
          didClose: () => {
            window.location.href = redirectPath;
          },
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Incorrect Password",
          text: "The password you entered is incorrect. Please try again.",
          confirmButtonColor: "#10b981",
        });
        startScanning();
      }
    } else {
      startScanning();
    }
  };

  const startScanning = () => {
    if (isScanning) return;

    setShowRetry(false);
    setStatus("Scanning for faces...");
    setIsScanning(true);
    setProgress(0);

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 1000);

    intervalRef.current = setInterval(async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          clearInterval(progressInterval);
          setProgress(100);
          const match = matcherRef.current.findBestMatch(detection.descriptor);
          console.log(
            `Match: ${match.label}, Distance: ${match.distance.toFixed(4)}`
          );
          setStatus(`Recognized: ${match.label}`);

          if (match.label !== "unknown") {
            clearScanning();
            const userData = userMapRef.current[match.label];

            let redirectPath = "/dashboard";
            if (userData.role === "admin") {
              redirectPath = "/admin/dashboard";
            } else if (userData.role === "teacher") {
              redirectPath = "/teacher/dashboard";
            } else {
              redirectPath = "/student/dashboard";
            }

            const fullName = `${userData.firstName} ${
              userData.middleInitial ? userData.middleInitial + " " : ""
            }${userData.lastName}`;

            await verifyPassword(userData, fullName, redirectPath);

            setTimeout(() => {
              startScanning();
            }, 10000);
          } else {
            clearScanning();
            setShowRetry(true);
            setStatus("Face not recognized");
            await new Promise((resolve) => setTimeout(resolve, 1000));
            Swal.fire({
              icon: "error",
              title: "Face Not Recognized",
              text: "No matching user found in our database.",
              confirmButtonColor: "#10b981",
            });
          }
        }
      } catch (err) {
        console.error("Scanning error:", err);
        clearScanning();
        setShowRetry(true);
        setStatus("Error during face detection");
      }
    }, 10000);
  };

  useEffect(() => {
    const init = async () => {
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
          video: true,
        });
        videoRef.current.srcObject = stream;

        setStatus("Loading user data...");
        const snapshot = await getDocs(collection(db, "users"));
        const labeledDescriptors = [];
        const userMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (Array.isArray(data.descriptor)) {
            const descriptor = new Float32Array(data.descriptor);
            const label = data.studentId || data.email;
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(label, [descriptor])
            );
            userMap[label] = {
              ...data,
              id: label,
              docId: doc.id,
              uid: data.uid || doc.id,
            };
          }
        });

        if (labeledDescriptors.length === 0) {
          setStatus("No registered users found.");
          setLoading(false);
          return;
        }

        matcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.3);
        userMapRef.current = userMap;

        setLoading(false);
        setStatus("Ready for face recognition");
        startScanning();
      } catch (err) {
        console.error(err);
        setStatus("Initialization failed");
        setLoading(false);

        Swal.fire({
          icon: "error",
          title: "Initialization Failed",
          html: `
            <div class="text-center">
              <p class="mb-4">Could not load models or camera.</p>
              <p class="text-sm text-gray-600">Please ensure:</p>
              <ul class="text-sm text-gray-600 text-left list-disc list-inside mx-auto max-w-xs">
                <li>Camera permissions are granted</li>
                <li>You're in a well-lit area</li>
                <li>Your browser supports WebRTC</li>
              </ul>
            </div>
          `,
          confirmButtonColor: "#10b981",
        });
      }
    };

    init();

    return () => {
      clearScanning();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
          />

          {/* Camera overlay grid */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-400/50"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-400/50"></div>
          </div>
        </div>

        {isScanning && (
          <>
            <div className="absolute -inset-4 flex items-center justify-center pointer-events-none">
              <div className="h-88 w-88 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
            </div>

            {/* Progress bar */}
            <div className="absolute -bottom-6 left-0 right-0 h-2 bg-emerald-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center mt-6 space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-emerald-300 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-1 border-4 border-emerald-200 border-b-transparent rounded-full animate-spin-reverse"></div>
          </div>
          <p className="text-center text-emerald-200 animate-pulse">{status}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 w-full max-w-md space-y-4">
            <div className="bg-emerald-800/50 backdrop-blur-sm rounded-lg p-4 shadow">
              <p className="text-center text-emerald-100 font-medium">
                {status}
              </p>
            </div>

            {showRetry && (
              <div className="flex justify-center gap-4">
                <button
                  onClick={startScanning}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition-all duration-300 flex items-center gap-2"
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
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
                      Scanning...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Try Again
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-white text-sm">
  <p className="mb-2">Don't have an account?</p>
  <a
    className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-lg transition-colors duration-300"
    href="/signup"
  >
    Register Now
  </a>

  {/* Optional: Add this button visibly if needed */}
  
  <button
    onClick={() => (window.location.href = "/quick-attendance")}
    className="ml-4 inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-lg transition-colors duration-300"
  >
    Quick Attendance
  </button> 
 
</div>

        </>
      )}

      <div className="mt-8 text-center text-emerald-300/50 text-xs">
        <p>Ensure your face is clearly visible in the frame</p>
      </div>


    </div>
  );
};

export default Login;
