import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const Login = () => {
  const videoRef = useRef();
  const [status, setStatus] = useState("Initializing...");
  const [loading, setLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
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
      title: "Enter your password",
      input: "password",
      inputLabel: `For security, please enter password for ${fullName}`,
      inputPlaceholder: "Enter your password",
      inputAttributes: {
        maxlength: 20,
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Verify",
      showLoaderOnConfirm: true,
      preConfirm: (inputPassword) => {
        if (!inputPassword) {
          Swal.showValidationMessage("Password is required");
        }
        return inputPassword;
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (password) {
      if (password === userData.password) {
        // In production, use proper password hashing comparison
        // Store all user data including docId
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
          timer: 2500,
          showConfirmButton: false,
          didClose: () => {
            window.location.href = redirectPath;
          },
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Incorrect Password",
          text: "The password you entered is incorrect. Please try again.",
        });
        startScanning(); // Restart scanning
      }
    } else {
      startScanning(); // Restart scanning if user canceled
    }
  };

  const startScanning = () => {
    if (isScanning) return;

    setShowRetry(false);
    setStatus("Scanning face...");
    setIsScanning(true);

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
          const match = matcherRef.current.findBestMatch(detection.descriptor);
          console.log(
            `Match: ${match.label}, Distance: ${match.distance.toFixed(4)}`
          );
          setStatus(`Match: ${match.label}`);

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

            // Show password verification
            await verifyPassword(userData, fullName, redirectPath);

            // Add a delay of 10 seconds before allowing the next scan to start
            setTimeout(() => {
              startScanning(); // Restart scanning after the delay
            }, 10000);
          } else {
            clearScanning();
            setShowRetry(true);
            setStatus("Face not recognized. Please try again.");
            await new Promise((resolve) => setTimeout(resolve, 1000));
            Swal.fire({
              icon: "error",
              title: "Face Not Recognized",
              text: "No matching user found.",
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

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        videoRef.current.srcObject = stream;

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
        startScanning();
      } catch (err) {
        console.error(err);
        setStatus("Error: Unable to start face recognition.");
        setLoading(false);

        Swal.fire({
          icon: "error",
          title: "Initialization Failed",
          text: "Could not load models or camera.",
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
    <div className="min-h-screen flex flex-col justify-center items-center gap-2 bg-emerald-800">
      <h1 className="text-2xl font-bold text-emerald-200 animate-bounce">
        BIO TRACK
      </h1>
      <div className="relative mt-5">
        <div className="h-80 w-80 md:w-120 md:h-120 rounded-full overflow-hidden border-4 border-green-500 shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-75 w-75 md:w-110 md:h-110 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center mt-4">
          <div className="w-8 h-8 border-4 border-emerald-300 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-center text-emerald-200">
            Loading models and camera...
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-center text-sm text-emerald-200">{status}</p>

          {showRetry && (
            <div className="flex justify-center mt-4">
              <button
                onClick={startScanning}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow transition-colors"
                disabled={isScanning}
              >
                {isScanning ? "Scanning..." : "Try Again"}
              </button>
            </div>
          )}

          <div className="text-center text-white">
            <p>
              No account?{" "}
              <a className="underline text-emerald-400" href="/signup">
                Register
              </a>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Login;
