import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";

const StaffPage = () => {
  const [classesToday, setClassesToday] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    const fetchClassesToday = async () => {
      const today = new Date().toLocaleString("en-US", { weekday: "long" });
      const snapshot = await getDocs(collection(db, "classes"));
      const allClasses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch teacher names for each class
      const classesWithTeacher = await Promise.all(
        allClasses.map(async (cls) => {
          const todaySchedule = cls.schedule?.find((s) => s.day === today);
          if (!todaySchedule) return null;

          let teacherName = "Unknown Teacher";
          if (cls.teacherID) {
            try {
              const teacherDoc = await getDoc(doc(db, "users", cls.teacherID));
              if (teacherDoc.exists()) {
                const t = teacherDoc.data();
                teacherName =
                  `${t.firstName || ""} ${t.lastName || ""}`.trim() ||
                  "Unnamed Teacher";
              }
            } catch {
              teacherName = "Unknown Teacher";
            }
          }

          return {
            id: cls.id,
            subjectName: cls.subjectName,
            schedule: todaySchedule,
            joinCode: cls.joinCode,
            teacherName,
            verification: cls.verification || null,
          };
        })
      );

      setClassesToday(classesWithTeacher.filter(Boolean));
    };
    fetchClassesToday();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ux9m4odg"); // Replace with your upload preset
    formData.append("cloud_name", "dzufxspg4"); // Replace with your cloud name

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dzufxspg4/gimage/upload", // Replace with your cloud name
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const verifyClass = async () => {
    if (!image || !selectedClass) return;

    setUploading(true);
    try {
      // Upload image to Cloudinary
      const imageUrl = await uploadImageToCloudinary(image);

      if (imageUrl) {
        // Update the class document in Firestore with verification data
        const classRef = doc(db, "classes", selectedClass.id);
        await updateDoc(classRef, {
          verification: {
            verified: true,
            verifiedAt: new Date().toISOString(),
            imageUrl,
          },
        });

        // Update local state
        setClassesToday(classesToday.map(cls => 
          cls.id === selectedClass.id 
            ? { ...cls, verification: { verified: true, verifiedAt: new Date().toISOString(), imageUrl } }
            : cls
        ));
      }
    } catch (error) {
      console.error("Error verifying class:", error);
    } finally {
      setUploading(false);
      setSelectedClass(null);
      setImage(null);
      setImagePreview(null);
    }
  };

  // Format today's date in 12-hour format
  const todayDate = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-white text-emerald-900 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Today's Classes</h1>
        <div className="text-sm mb-6 text-emerald-700">{todayDate}</div>
        
        {/* Verification Modal */}
        {selectedClass && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">
                Verify {selectedClass.subjectName}
              </h2>
              <p className="mb-4 text-sm">
                Take a photo of the class as proof of attendance
              </p>
              
              {imagePreview ? (
                <div className="mb-4">
                  <img 
                    src={imagePreview} 
                    alt="Class verification" 
                    className="w-full h-48 object-cover rounded"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-emerald-300 rounded-lg p-8 mb-4 text-center">
                  <p className="text-emerald-500 text-sm">No image selected</p>
                </div>
              )}
              
              <div className="flex flex-col space-y-2">
                <label className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium text-center cursor-pointer">
                  Take Photo/Upload
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedClass(null);
                      setImage(null);
                      setImagePreview(null);
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded text-xs font-medium"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={verifyClass}
                    className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                    disabled={!image || uploading}
                  >
                    {uploading ? "Uploading..." : "Verify"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {classesToday.length === 0 ? (
          <div className="text-center py-8 text-emerald-400">
            No classes scheduled for today.
          </div>
        ) : (
          <div className="space-y-4">
            {classesToday.map((cls, idx) => (
              <div
                key={idx}
                className="bg-white shadow-sm rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border border-emerald-100"
              >
                <div>
                  <div className="font-semibold text-lg">{cls.subjectName}</div>
                  <div className="text-xs text-emerald-700 mb-1">
                    {cls.schedule.start} - {cls.schedule.end}
                  </div>
                  <div className="text-xs text-emerald-500 mb-1">
                    Teacher: {cls.teacherName}
                  </div>
                  {cls.joinCode && (
                    <div className="text-xs text-emerald-400">
                      Code: {cls.joinCode}
                    </div>
                  )}
                  {cls.verification && (
                    <div className="mt-2">
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                        Verified
                      </span>
                      {cls.verification.imageUrl && (
                        <a 
                          href={cls.verification.imageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-emerald-600 underline"
                        >
                          View Proof
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {!cls.verification ? (
                  <button 
                    onClick={() => setSelectedClass(cls)}
                    className="mt-3 sm:mt-0 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                  >
                    Verify Class
                  </button>
                ) : (
                  <div className="text-xs text-emerald-500 mt-3 sm:mt-0">
                    Verified at {new Date(cls.verification.verifiedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPage;