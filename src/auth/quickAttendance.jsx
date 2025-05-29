import React, { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";

const QuickAttendance = () => {
  const videoRef = useRef();
  const [status, setStatus] = useState("Initializing Quick Attendance...");
  const [loading, setLoading] = useState(true);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [userMap, setUserMap] = useState({});
  const [isScanning, setIsScanning] = useState(false);

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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setStatus("Loading user data...");
        const snapshot = await getDocs(collection(db, "users"));
        const labeledDescriptors = [];
        const users = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.descriptor && Array.isArray(data.descriptor)) {
            const descriptor = new Float32Array(data.descriptor);
            const label = data.studentId || data.email;
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(label, [descriptor])
            );
            users[label] = {
              ...data,
              docId: docSnap.id,
              id: label,
              uid: data.uid || docSnap.id,
            };
          }
        });

        if (labeledDescriptors.length === 0) {
          setStatus("No registered users found.");
          setLoading(false);
          return;
        }

        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.3);
        setFaceMatcher(matcher);
        setUserMap(users);
        setLoading(false);
        setStatus("Ready. Please position your face in front of the camera.");
        setIsScanning(true);

        startRecognition(matcher, users);
      } catch (error) {
        console.error("Initialization error:", error);
        setStatus("Failed to initialize Quick Attendance.");
        setLoading(false);
        Swal.fire({
          icon: "error",
          title: "Initialization Error",
          text: "Could not load models, camera, or user data.",
          confirmButtonColor: "#10b981",
        });
      }
    };

    init();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecognition = (matcher, users) => {
    const interval = setInterval(async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const match = matcher.findBestMatch(detection.descriptor);
          console.log(
            `Match: ${match.label}, Distance: ${match.distance.toFixed(4)}`
          );
          if (match && match.label !== "unknown") {
            clearInterval(interval);
            setIsScanning(false);
            setStatus(`Recognized: ${match.label}`);
            const userData = users[match.label];
            if (userData) {
              const fullName = `${userData.firstName} ${
                userData.middle ? userData.middle + " " : ""
              }${userData.lastName}`;
              const verified = await verifyPassword(userData, fullName);
              if (verified) {
                markAttendance(userData);
              } else {
                setStatus("Password verification failed. Try again.");
                setTimeout(() => {
                  setIsScanning(true);
                  startRecognition(matcher, users);
                }, 2000);
              }
            }
          }
        }
      } catch (error) {
        console.error("Recognition error:", error);
      }
    }, 5000);
  };

  const verifyPassword = async (userData, fullName) => {
    const { value: password } = await Swal.fire({
      title: "Password Verification",
      text: `Please enter the password for ${fullName}`,
      input: "password",
      inputPlaceholder: "Enter your password",
      showCancelButton: true,
      confirmButtonText: "Verify",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#ef4444",
      preConfirm: (inputPassword) => {
        if (!inputPassword) {
          Swal.showValidationMessage("Password is required");
        }
        return inputPassword;
      },
    });

    if (password) {
      if (password === userData.password) {
        return true;
      } else {
        Swal.fire({
          icon: "error",
          title: "Incorrect Password",
          text: "The password you entered is incorrect.",
          confirmButtonColor: "#10b981",
        });
        return false;
      }
    }
    return false;
  };

  const markAttendance = async (userData) => {
    try {
      const now = new Date();
      const currentDay = now.toLocaleString("en-US", { weekday: "long" });
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime24 = `${currentHours}:${
        currentMinutes < 10 ? "0" + currentMinutes : currentMinutes
      }`;

      const convertTo12HourFormat = (time24) => {
        const [hours, minutes] = time24.split(":");
        const hour = parseInt(hours, 10);
        const suffix = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${suffix}`;
      };

      const timeToMinutes = (timeStr) => {
        const [time, period] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);
        if (period === "PM" && hours !== 12) {
          hours += 12;
        } else if (period === "AM" && hours === 12) {
          hours = 0;
        }
        return hours * 60 + minutes;
      };

      const currentTime12 = convertTo12HourFormat(currentTime24);
      const currentTimeInMinutes = timeToMinutes(currentTime12);

      const classSnapshot = await getDocs(collection(db, "classes"));
      const matchingSubjects = [];
      classSnapshot.forEach((docSnap) => {
        const subject = docSnap.data();
        if (subject.studentIDs && subject.studentIDs.includes(userData.docId)) {
          if (subject.schedule && Array.isArray(subject.schedule)) {
            const matchedSchedule = subject.schedule.find((sched) => {
              if (sched.day !== currentDay) return false;
              const startInMinutes = timeToMinutes(
                convertTo12HourFormat(sched.start)
              );
              const endInMinutes = timeToMinutes(
                convertTo12HourFormat(sched.end)
              );
              return (
                currentTimeInMinutes >= startInMinutes &&
                currentTimeInMinutes <= endInMinutes
              );
            });
            if (matchedSchedule) {
              matchingSubjects.push({ ...subject, id: docSnap.id });
            }
          }
        }
      });

      if (matchingSubjects.length === 0) {
        Swal.fire({
          icon: "error",
          title: "No Scheduled Class",
          text: "You do not have any class scheduled for now.",
          confirmButtonColor: "#10b981",
        });
        setStatus("No scheduled class found.");
        return;
      }

      const subject = matchingSubjects[0];
      const classID =
        subject.joinCode || subject.subjectName.replace(/\s/g, "_");
      const today = now.toISOString().split("T")[0];
      const attendanceRef = doc(
        db,
        "attendance",
        classID,
        today,
        userData.docId
      );
      const attendanceSnap = await getDoc(attendanceRef);

      if (attendanceSnap.exists()) {
        const data = attendanceSnap.data();
        if (!data.timeOut) {
          // Allow time out only if current time is between the scheduled end and 60 minutes after
          const isWithinTimeoutWindow = subject.schedule?.some((sched) => {
            if (sched.day !== currentDay) return false;
            const endTime = timeToMinutes(convertTo12HourFormat(sched.end));
            return (
              currentTimeInMinutes >= endTime &&
              currentTimeInMinutes <= endTime + 60
            );
          });
          if (!isWithinTimeoutWindow) {
            Swal.fire({
              icon: "error",
              title: "Error",
              text: `Attendance can only be marked between the scheduled class end and 1 hour after (e.g., if the class ends at ${subject.schedule
                .filter((s) => s.day === currentDay)
                .map((s) => s.end)
                .join(", ")}, then between that time and one hour later).`,
            });
            setStatus("Not within the permitted time window.");
            return;
          }

          const result = await Swal.fire({
            title: "Confirm Time-out",
            text: "Are you sure you want to time out?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, time out",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#ef4444",
          });

          if (result.isConfirmed) {
            await updateDoc(attendanceRef, {
              timeOut: serverTimestamp(),
              verificationMethod: "face_recognition",
            });
            Swal.fire({
              icon: "success",
              title: "Success",
              text: "Time-out recorded successfully!",
              confirmButtonColor: "#10b981",
            });
          } else {
            setStatus("Time out canceled.");
            return;
          }
        } else {
          Swal.fire({
            icon: "info",
            title: "Already Recorded",
            text: "Attendance already marked for today.",
            confirmButtonColor: "#10b981",
          });
        }
      } else {
        await setDoc(attendanceRef, {
          timeIn: serverTimestamp(),
          verifiedBy: "face_recognition",
        });
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Attendance marked successfully!",
          confirmButtonColor: "#10b981",
        });
      }
      setStatus("Attendance process completed.");
    } catch (error) {
      console.error("Attendance error:", error);
      Swal.fire({
        icon: "error",
        title: "Attendance Error",
        text: "Failed to mark attendance.",
        confirmButtonColor: "#10b981",
      });
      setStatus("Attendance failed.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-gradient-to-br from-emerald-900 to-emerald-700 p-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">BIO TRACK</h1>
        <p className="text-emerald-200">Quick Attendance System</p>
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
          <div className="absolute -inset-4 flex items-center justify-center pointer-events-none">
            <div className="h-88 w-88 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
          </div>
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
        <div className="mt-6 w-full max-w-md space-y-4">
          <div className="bg-emerald-800/50 backdrop-blur-sm rounded-lg p-4 shadow">
            <p className="text-center text-emerald-100 font-medium">{status}</p>
          </div>

          <div className="text-center">
            <button
              onClick={() => (window.location.href = "/login")}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition-colors duration-300"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-emerald-300/50 text-xs">
        <p>Position your face clearly in the frame for attendance marking</p>
      </div>
    </div>
  );
};

export default QuickAttendance;
