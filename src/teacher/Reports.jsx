import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { format, parseISO, eachDayOfInterval } from "date-fns";
// New imports for the chart
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all classes taught by this teacher
  useEffect(() => {
    const fetchTeacherClasses = async () => {
      try {
        const teacherId = localStorage.getItem("userDocId");
        if (!teacherId) {
          setError("Teacher ID not found in localStorage");
          return;
        }

        const classesCol = collection(db, "classes");
        const q = query(classesCol, where("teacherID", "==", teacherId));
        const querySnapshot = await getDocs(q);

        const classesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClass(classesData[0].id);
        }
      } catch (err) {
        setError(`Error fetching classes: ${err.message}`);
        console.error("Error fetching classes:", err);
      }
    };

    fetchTeacherClasses();
  }, []);

  // Fetch attendance data when class or date range changes
  useEffect(() => {
    if (!selectedClass) return;

    const fetchAttendanceData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get class document
        const classRef = doc(db, "classes", selectedClass);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) {
          setError("Class document not found");
          return;
        }
        const classData = classSnap.data();
        // Use joinCode or fallback to match Attendance.jsx path
        const attendanceClassID =
          classData.joinCode || classData.subjectName.replace(/\s/g, "_");

        const studentIDs = classData.studentIDs || [];
        if (studentIDs.length === 0) {
          setError("No students enrolled in this class");
          return;
        }

        // Generate date array from the selected dateRange
        const startDate = parseISO(dateRange.start);
        const endDate = parseISO(dateRange.end);
        const dateArray = eachDayOfInterval({
          start: startDate,
          end: endDate,
        }).map((date) => format(date, "yyyy-MM-dd"));

        // Fetch attendance for each student and each date
        const attendancePromises = studentIDs.map(async (studentId) => {
          try {
            // Get student info
            const studentRef = doc(db, "users", studentId);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) {
              console.warn(`Student document ${studentId} not found`);
              return null;
            }
            const studentData = studentSnap.data();
            if (!studentData?.firstName || !studentData?.lastName) {
              console.warn(`Student ${studentId} missing name data`);
              return null;
            }

            // Check attendance for each date
            const records = await Promise.all(
              dateArray.map(async (date) => {
                try {
                  // Build attendance document path using attendanceClassID
                  const attendanceRef = doc(
                    db,
                    "attendance",
                    attendanceClassID,
                    date,
                    studentId
                  );
                  const attendanceSnap = await getDoc(attendanceRef);
                  if (attendanceSnap.exists()) {
                    const data = attendanceSnap.data() || {};
                    // Convert timestamps to Date objects
                    let timeIn = data.timeIn
                      ? typeof data.timeIn.toDate === "function"
                        ? data.timeIn.toDate()
                        : new Date(data.timeIn)
                      : null;
                    let timeOut = data.timeOut
                      ? typeof data.timeOut.toDate === "function"
                        ? data.timeOut.toDate()
                        : new Date(data.timeOut)
                      : null;
                    return {
                      date,
                      timeIn: timeIn ? format(timeIn, "hh:mm a") : null,
                      timeOut: timeOut ? format(timeOut, "hh:mm a") : null,
                      verificationMethod:
                        data.verificationMethod || data.verifiedBy || null,
                      status:
                        timeIn && timeOut
                          ? "Present"
                          : timeIn
                          ? "Time In Only"
                          : "Absent",
                    };
                  }
                } catch (err) {
                  console.error(`Error fetching attendance for ${date}:`, err);
                }
                return {
                  date,
                  timeIn: null,
                  timeOut: null,
                  verificationMethod: null,
                  status: "Absent",
                };
              })
            );

            return {
              studentId,
              studentName: `${studentData.firstName} ${studentData.lastName}`,
              records,
            };
          } catch (err) {
            console.error(`Error processing student ${studentId}:`, err);
            return null;
          }
        });

        const results = (await Promise.all(attendancePromises)).filter(Boolean);
        setAttendanceData(results);
      } catch (err) {
        setError(`Error fetching attendance data: ${err.message}`);
        console.error("Error fetching attendance data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [selectedClass, dateRange]);

  const handleDateChange = (e) => {
    setDateRange({
      ...dateRange,
      [e.target.name]: e.target.value,
    });
  };

  // Aggregate attendance data for chart display
  const aggregatedData = useMemo(() => {
    if (attendanceData.length === 0) return null;

    // Get date labels from the first student's records
    const dates = attendanceData[0].records.map((rec) => rec.date);
    const presentCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Present" ? 1 : 0);
      }, 0)
    );
    const timeInOnlyCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Time In Only" ? 1 : 0);
      }, 0)
    );
    const absentCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Absent" ? 1 : 0);
      }, 0)
    );

    return {
      labels: dates.map((date) => format(parseISO(date), "MMM d")),
      datasets: [
        {
          label: "Present",
          data: presentCounts,
          backgroundColor: "green",
        },
        {
          label: "Time In Only",
          data: timeInOnlyCounts,
          backgroundColor: "yellow",
        },
        {
          label: "Absent",
          data: absentCounts,
          backgroundColor: "red",
        },
      ],
    };
  }, [attendanceData]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Attendance Reports</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.subjectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="end"
              value={dateRange.end}
              onChange={handleDateChange}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    {attendanceData.length > 0 &&
                      attendanceData[0].records.map((record) => (
                        <th
                          key={record.date}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {format(parseISO(record.date), "MMM d")}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceData.map((student) => (
                    <tr key={student.studentId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.studentName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.studentId}
                        </div>
                      </td>

                      {student.records.map((record) => (
                        <td
                          key={`${student.studentId}-${record.date}`}
                          className="px-4 py-2"
                        >
                          <div className="flex flex-col items-center">
                            {record.status === "Present" ? (
                              <>
                                <span className="text-green-600 font-medium">
                                  Present
                                </span>
                                <span className="text-xs text-gray-500">
                                  In: {record.timeIn || "—"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Out: {record.timeOut || "—"}
                                </span>
                              </>
                            ) : record.status === "Time In Only" ? (
                              <>
                                <span className="text-yellow-600 font-medium">
                                  Time In Only
                                </span>
                                <span className="text-xs text-gray-500">
                                  In: {record.timeIn || "—"}
                                </span>
                              </>
                            ) : (
                              <span className="text-red-600 font-medium">
                                Absent
                              </span>
                            )}
                            {record.verificationMethod && (
                              <span className="text-xs text-gray-400 mt-1">
                                {record.verificationMethod}
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Attendance Summary Chart */}
            {aggregatedData && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">
                  Attendance Summary Chart
                </h2>
                <Bar
                  data={aggregatedData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: "top" } },
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
