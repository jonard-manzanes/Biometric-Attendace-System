import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { eachDayOfInterval, format } from "date-fns";

const Excuses = () => {
  const [excuses, setExcuses] = useState([]);
  const [filteredExcuses, setFilteredExcuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    const fetchExcuses = async () => {
      setLoading(true);
      try {
        // Fetch classes
        const classesSnap = await getDocs(collection(db, "classes"));
        const classes = classesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch excuses
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);
        const dateRange = eachDayOfInterval({
          start: oneMonthAgo,
          end: today,
        }).map((date) => format(date, "yyyy-MM-dd"));

        const excusesData = [];
        for (const cls of classes) {
          const classID = cls.joinCode || cls.subjectName.replace(/\s/g, "_");
          
          for (const date of dateRange) {
            try {
              const studentsCol = collection(db, "attendance", classID, date);
              const studentsSnap = await getDocs(studentsCol);

              studentsSnap.forEach((studentDoc) => {
                const data = studentDoc.data();
                if (data.excuse) {
                  excusesData.push({
                    id: `${classID}-${date}-${studentDoc.id}`,
                    studentId: studentDoc.id,
                    studentName: data.studentName || studentDoc.id,
                    classID,
                    className: cls.subjectName,
                    date,
                    reason: data.excuse.reason,
                    status: data.excuse.status || "pending",
                    image: data.excuse.image,
                    submittedAt: data.excuse.submittedAt?.toDate() || new Date(),
                  });
                }
              });
            } catch (error) {
              console.error(`Error processing ${date} for ${cls.subjectName}:`, error);
            }
          }
        }

        setExcuses(excusesData.sort((a, b) => b.submittedAt - a.submittedAt));
      } catch (error) {
        console.error("Error fetching excuses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExcuses();
  }, []);

  useEffect(() => {
    if (excuses.length > 0) {
      filterExcuses();
    }
  }, [activeTab, excuses]);

  const filterExcuses = () => {
    let filtered = [];
    switch (activeTab) {
      case "pending":
        filtered = excuses.filter(e => e.status === "pending");
        break;
      case "approved":
        filtered = excuses.filter(e => e.status === "approved");
        break;
      case "declined":
        filtered = excuses.filter(e => e.status === "declined");
        break;
      default:
        filtered = excuses;
    }
    setFilteredExcuses(filtered);
  };

  const handleExcuseAction = async (excuse, action) => {
    if (!excuse) return;
    setLoading(true);
    try {
      const attendanceRef = doc(
        db,
        "attendance",
        excuse.classID,
        excuse.date,
        excuse.studentId
      );
      
      await updateDoc(attendanceRef, {
        "excuse.status": action === "approve" ? "approved" : "declined",
        attendanceStatus: action === "approve" ? "excuse" : "absent",
      });

      // Update local state
      setExcuses(prev => prev.map(e => 
        e.id === excuse.id 
          ? { ...e, status: action === "approve" ? "approved" : "declined" } 
          : e
      ));
      setSelectedExcuse(null);
    } catch (error) {
      console.error("Error updating excuse:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-800";
      case "declined": return "bg-red-100 text-red-800";
      default: return "bg-yellow-100 text-yellow-800";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "approved": return "Approved";
      case "declined": return "Declined";
      default: return "Pending Review";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student excuses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Student Excuses</h1>
        <p className="text-gray-600">
          {filteredExcuses.length} {activeTab} excuse{filteredExcuses.length !== 1 ? "s" : ""}
        </p>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mt-4">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === "pending" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === "approved" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab("declined")}
            className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === "declined" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Declined
          </button>
        </div>
      </div>

      {/* No Excuses State */}
      {filteredExcuses.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">No {activeTab} excuses</h3>
          <p className="text-gray-600">
            {activeTab === "pending" 
              ? "All excuses have been processed." 
              : `No excuses have been ${activeTab} yet.`}
          </p>
        </div>
      )}

      {/* Excuses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredExcuses.map((excuse) => (
          <div
            key={excuse.id}
            onClick={() => setSelectedExcuse(excuse)}
            className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-blue-100 border border-transparent"
          >
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {excuse.studentName}
                  </h3>
                  <p className="text-sm text-gray-500">{excuse.className}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(excuse.status)}`}>
                  {getStatusText(excuse.status)}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Absence Date</p>
                  <p className="text-sm font-medium">{formatDate(excuse.date)}</p>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Reason</p>
                  <p className="text-sm line-clamp-2">{excuse.reason}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Excuse Detail Modal */}
      {selectedExcuse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}

            <div className="sticky top-0 bg-white p-6 pb-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Excuse Details</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedExcuse.status)}`}>
                    {getStatusText(selectedExcuse.status)}
                  </span>
                  <span className="text-sm text-gray-500">
                    Submitted on {formatDate(selectedExcuse.submittedAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedExcuse(null)}
                className="text-gray-400 hover:text-gray-500 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Student Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Student Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Student Name</p>
                      <p className="font-medium">{selectedExcuse.studentName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Class Name</p>
                      <p className="font-medium">{selectedExcuse.className}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Absence Date</p>
                      <p>{formatDate(selectedExcuse.date)}</p>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Reason for Absence</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="whitespace-pre-line">{selectedExcuse.reason}</p>
                  </div>
                </div>

                {/* Supporting Document */}
                {selectedExcuse.image && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Supporting Document</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={selectedExcuse.image}
                        alt="Supporting document"
                        className="w-full h-auto max-h-64 object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedExcuse.status === "pending" && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleExcuseAction(selectedExcuse, "approve")}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded font-medium transition-colors"
                    >
                      Approve Excuse
                    </button>
                    <button
                      onClick={() => handleExcuseAction(selectedExcuse, "decline")}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded font-medium transition-colors"
                    >
                      Decline Excuse
                    </button>
                  </div>
                )}

                {/* Status Message */}
                {selectedExcuse.status !== "pending" && (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
                    This excuse has been {selectedExcuse.status}.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Excuses;