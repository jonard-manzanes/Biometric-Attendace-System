import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

const StaffPage = () => {
  const [classesToday, setClassesToday] = useState([]);

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
            subjectName: cls.subjectName,
            schedule: todaySchedule,
            joinCode: cls.joinCode,
            teacherName,
          };
        })
      );

      setClassesToday(classesWithTeacher.filter(Boolean));
    };
    fetchClassesToday();
  }, []);

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
                </div>
                <button className="mt-3 sm:mt-0 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium">
                  Verify Class
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPage;
