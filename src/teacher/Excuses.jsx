import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { eachDayOfInterval, format } from "date-fns";

const Excuses = () => {
  const [excusesByClass, setExcusesByClass] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExcuse, setSelectedExcuse] = useState(null);

  useEffect(() => {
    const fetchExcuses = async () => {
      setLoading(true);
      try {
        const classesSnap = await getDocs(collection(db, "classes"));
        const classes = classesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const excusesData = [];
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);

        // Generate all dates in the range
        const dateRange = eachDayOfInterval({
          start: oneMonthAgo,
          end: today,
        }).map((date) => format(date, "yyyy-MM-dd"));

        for (const cls of classes) {
          const classID = cls.joinCode || cls.subjectName.replace(/\s/g, "_");
          const excuses = [];

          for (const date of dateRange) {
            try {
              const studentsCol = collection(db, "attendance", classID, date);
              const studentsSnap = await getDocs(studentsCol);

              studentsSnap.forEach((studentDoc) => {
                const data = studentDoc.data();
                if (data.excuse && data.excuse.status !== "approved") {
                  const studentName = data.studentName || studentDoc.id; // Fallback to ID if name not available
                  excuses.push({
                    studentId: studentDoc.id,
                    studentName,
                    classID,
                    date,
                    attendanceDocId: studentDoc.id,
                    ...data.excuse,
                  });
                }
              });
            } catch (error) {
              console.error(`Error processing date ${date}:`, error);
              continue;
            }
          }

          if (excuses.length > 0) {
            excusesData.push({
              className: cls.subjectName,
              classCode: classID,
              excuses: excuses.sort(
                (a, b) => new Date(b.date) - new Date(a.date)
              ),
            });
          }
        }

        setExcusesByClass(excusesData);
      } catch (error) {
        console.error("Error fetching excuses:", error);
      }
      setLoading(false);
    };

    fetchExcuses();
  }, []);

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
      setSelectedExcuse(null);

      // Refresh excuses
      const fetchExcuses = async () => {
        const classesSnap = await getDocs(collection(db, "classes"));
        const classes = classesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);

        const excusesData = [];

        for (const cls of classes) {
          const classID = cls.joinCode || cls.subjectName.replace(/\s/g, "_");
          const attendanceCol = collection(db, "attendance", classID);
          const attendanceQuery = query(
            attendanceCol,
            where("date", ">=", oneMonthAgo.toISOString().split("T")[0]),
            where("date", "<=", today.toISOString().split("T")[0])
          );

          const attendanceSnap = await getDocs(attendanceQuery);

          const excuses = [];
          for (const dateDoc of attendanceSnap.docs) {
            const date = dateDoc.id;
            const studentsCol = collection(db, "attendance", classID, date);
            const studentsSnap = await getDocs(studentsCol);

            for (const studentDoc of studentsSnap.docs) {
              const data = studentDoc.data();
              if (data.excuse && data.excuse.status !== "approved") {
                const studentRef = doc(db, "users", studentDoc.id);
                const studentInfo = await getDoc(studentRef);
                excuses.push({
                  studentId: studentDoc.id,
                  studentName: studentInfo.exists()
                    ? `${studentInfo.data().firstName} ${studentInfo.data().lastName}`
                    : studentDoc.id,
                  classID,
                  date,
                  attendanceDocId: studentDoc.id,
                  ...data.excuse,
                });
              }
            }
          }

          if (excuses.length > 0) {
            excusesData.push({
              className: cls.subjectName,
              classCode: classID,
              excuses: excuses.sort(
                (a, b) => new Date(b.date) - new Date(a.date)
              ),
            });
          }
        }

        setExcusesByClass(excusesData);
      };
      await fetchExcuses();
    } catch (error) {
      console.error("Error updating excuse:", error);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50 border-green-200";
      case "declined":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-orange-600 bg-orange-50 border-orange-200";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "declined":
        return "Declined";
      default:
        return "Pending Review";
    }
  };

  const formatDate = (dateString) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  if (loading) {
    return (
      <div className="font-sans text-base max-w-4xl mx-auto p-10 bg-gray-50 min-h-screen">
        <div className="bg-white p-10 rounded-lg shadow-sm text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="m-0 text-gray-600">Loading excuses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-base bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-8 rounded-lg shadow-sm mb-6">
        <h1 className="m-0 mb-2 text-2xl font-semibold text-gray-800">
          Student Excuses
        </h1>
        <p className="m-0 text-gray-600 text-sm">
          Review and manage student absence excuses from the past month
        </p>
      </div>

      {/* No Excuses State */}
      {excusesByClass.length === 0 && (
        <div className="bg-white p-10 rounded-lg shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
            📋
          </div>
          <h3 className="m-0 mb-2 text-gray-800">No excuses to review</h3>
          <p className="m-0 text-gray-600">
            There are no pending student excuses from the past month.
          </p>
        </div>
      )}

      {/* Excuses by Class */}
      {excusesByClass.map((cls) => (
        <div
          key={cls.classCode}
          className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden"
        >
          {/* Class Header */}
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h2 className="m-0 mb-1 text-lg font-semibold text-gray-800">
              {cls.className}
            </h2>
            <p className="m-0 text-sm text-gray-600">
              {cls.excuses.length} excuse{cls.excuses.length !== 1 ? "s" : ""}{" "}
              pending review
            </p>
          </div>

          {/* Excuses List */}
          <div className="py-2">
            {cls.excuses.map((excuse, idx) => (
              <div
                key={idx}
                onClick={() =>
                  setSelectedExcuse({ ...excuse, className: cls.className })
                }
                className={`px-6 py-4 ${idx < cls.excuses.length - 1 ? "border-b border-gray-100" : ""} cursor-pointer transition-colors hover:bg-gray-50`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <div className="font-medium text-gray-800">
                        {excuse.studentName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(excuse.date)}
                      </div>
                    </div>
                    <div className="text-gray-600 mb-2 leading-snug">
                      {excuse.reason}
                    </div>
                    {excuse.image && (
                      <div className="mb-2">
                        <img
                          src={excuse.image}
                          alt="Proof"
                          className="w-15 h-15 object-cover rounded border border-gray-100"
                        />
                      </div>
                    )}
                  </div>
                  <div
                    className={`px-2 py-1 rounded border text-xs font-medium whitespace-nowrap ${getStatusColor(excuse.status)}`}
                  >
                    {getStatusText(excuse.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal for excuse details */}
      {selectedExcuse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto relative">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-lg">
              <button
                onClick={() => setSelectedExcuse(null)}
                className="absolute top-4 right-4 text-gray-600 text-2xl cursor-pointer p-1 leading-none"
              >
                ×
              </button>
              <h2 className="m-0 mr-8 text-xl font-semibold text-gray-800">
                Excuse Details
              </h2>
              <div className="text-sm text-gray-500 mt-1">
                {formatDate(selectedExcuse.date)}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Student</div>
                <div className="text-base font-medium text-gray-800">
                  {selectedExcuse.studentName}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Class</div>
                <div className="text-base text-gray-800">
                  {selectedExcuse.className}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Reason</div>
                <div className="text-base text-gray-800 leading-relaxed">
                  {selectedExcuse.reason}
                </div>
              </div>

              {selectedExcuse.image && (
                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Proof Attached
                  </div>
                  <img
                    src={selectedExcuse.image}
                    alt="Proof"
                    className="w-full max-w-xs h-auto rounded border border-gray-100"
                  />
                </div>
              )}

              <div className="mb-6">
                <div className="text-sm text-gray-600 mb-1">Status</div>
                <div
                  className={`inline-block px-2 py-1 rounded border text-sm font-medium ${getStatusColor(selectedExcuse.status)}`}
                >
                  {getStatusText(selectedExcuse.status)}
                </div>
              </div>

              {/* Action Buttons */}
              {selectedExcuse.status !== "approved" &&
                selectedExcuse.status !== "declined" && (
                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={() =>
                        handleExcuseAction(selectedExcuse, "approve")
                      }
                      className="flex-1 bg-green-600 text-white border-none py-3 px-4 rounded text-sm font-medium cursor-pointer hover:bg-green-700 transition-colors"
                    >
                      Approve Excuse
                    </button>
                    <button
                      onClick={() =>
                        handleExcuseAction(selectedExcuse, "decline")
                      }
                      className="flex-1 bg-red-600 text-white border-none py-3 px-4 rounded text-sm font-medium cursor-pointer hover:bg-red-700 transition-colors"
                    >
                      Decline Excuse
                    </button>
                  </div>
                )}

              {(selectedExcuse.status === "approved" ||
                selectedExcuse.status === "declined") && (
                <div className="text-center p-4 bg-gray-50 rounded text-gray-600 text-sm">
                  This excuse has been {selectedExcuse.status}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Excuses;
