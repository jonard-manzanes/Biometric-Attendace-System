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
import {
  format,
  parseISO,
  eachDayOfInterval,
  differenceInMinutes,
} from "date-fns";
import { Bar, Line } from "react-chartjs-2";
import * as XLSX from "xlsx";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
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
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'charts'

  // New states for semester configuration and holiday management
  const [semesterRange, setSemesterRange] = useState({
    start: "",
    end: "",
  });
  const [holidayDates, setHolidayDates] = useState([]);
  const [newHoliday, setNewHoliday] = useState("");

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

                    // Calculate duration in minutes if both times exist
                    let duration = null;
                    if (timeIn && timeOut) {
                      duration = differenceInMinutes(timeOut, timeIn);
                    }

                    return {
                      date,
                      timeIn: timeIn ? format(timeIn, "hh:mm a") : null,
                      timeOut: timeOut ? format(timeOut, "hh:mm a") : null,
                      timeInRaw: timeIn,
                      timeOutRaw: timeOut,
                      duration,
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
                  timeInRaw: null,
                  timeOutRaw: null,
                  duration: null,
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

  // Calculate total valid class days from semester range (excluding weekends and holidays)
  const totalClassDays = useMemo(() => {
    if (!semesterRange.start || !semesterRange.end) return 0;
    const start = parseISO(semesterRange.start);
    const end = parseISO(semesterRange.end);
    const allDays = eachDayOfInterval({ start, end });
    // Only count Mondays (getDay() === 1) and exclude holidays
    const validDays = allDays.filter((day) => {
      if (day.getDay() !== 1) return false;
      const formatted = format(day, "yyyy-MM-dd");
      return !holidayDates.includes(formatted);
    });
    return validDays.length;
  }, [semesterRange, holidayDates]);

  // Export attendance summary for the semester
  const handleExportSummary = () => {
    if (!semesterRange.start || !semesterRange.end) {
      alert("Please set the semester start and end dates.");
      return;
    }
    if (totalClassDays === 0) {
      alert("Total class days cannot be 0.");
      return;
    }

    const exportData = attendanceData.map((student) => {
      // Count days present within the semester range
      const daysPresent = student.records.filter((record) => {
        return (
          record.date >= semesterRange.start &&
          record.date <= semesterRange.end &&
          record.status === "Present"
        );
      }).length;
      const daysAbsent = totalClassDays - daysPresent;
      const attendancePercentage = (
        (daysPresent / totalClassDays) *
        100
      ).toFixed(1);
      const remarks =
        attendancePercentage >= 85 ? "Passed Attendance" : "Needs Improvement";
      return {
        "Student ID": student.studentId,
        "Full Name": student.studentName,
        "Days Present": daysPresent,
        "Days Absent": daysAbsent,
        "Attendance Percentage": `${attendancePercentage}%`,
        Remarks: remarks,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Summary");
    XLSX.writeFile(workbook, "Attendance_Summary.xlsx");
  };

  // Handlers for holiday management
  const handleAddHoliday = () => {
    if (newHoliday && !holidayDates.includes(newHoliday)) {
      setHolidayDates([...holidayDates, newHoliday]);
      setNewHoliday("");
    }
  };

  const handleRemoveHoliday = (date) => {
    setHolidayDates(holidayDates.filter((d) => d !== date));
  };

  // Calculate average time in/out and duration for the class
  const classTimeStats = useMemo(() => {
    if (attendanceData.length === 0) return null;

    // Collect all valid time entries
    const allTimeIns = [];
    const allTimeOuts = [];
    const allDurations = [];

    attendanceData.forEach((student) => {
      student.records.forEach((record) => {
        if (record.timeInRaw) allTimeIns.push(record.timeInRaw);
        if (record.timeOutRaw) allTimeOuts.push(record.timeOutRaw);
        if (record.duration !== null) allDurations.push(record.duration);
      });
    });

    // Calculate averages
    const calculateAverageTime = (times) => {
      if (times.length === 0) return null;
      const totalMinutes = times.reduce((sum, time) => {
        return sum + time.getHours() * 60 + time.getMinutes();
      }, 0);
      const avgMinutes = totalMinutes / times.length;
      const hours = Math.floor(avgMinutes / 60);
      const minutes = Math.floor(avgMinutes % 60);
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    };

    const calculateAverageDuration = (durations) => {
      if (durations.length === 0) return null;
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      return `${Math.round(avg)} minutes`;
    };

    return {
      averageTimeIn: calculateAverageTime(allTimeIns),
      averageTimeOut: calculateAverageTime(allTimeOuts),
      averageDuration: calculateAverageDuration(allDurations),
      totalPresent: allDurations.length,
    };
  }, [attendanceData]);

  // Aggregate attendance data for chart display
  const aggregatedData = useMemo(() => {
    if (attendanceData.length === 0) return null;

    // Get date labels from the first student's records
    const dates = attendanceData[0].records.map((rec) => rec.date);

    // Attendance status counts
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

    // Average duration per day
    const averageDurations = dates.map((date) => {
      const durations = [];
      attendanceData.forEach((student) => {
        const record = student.records.find((r) => r.date === date);
        if (record && record.duration !== null) {
          durations.push(record.duration);
        }
      });
      return durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    });

    return {
      attendance: {
        labels: dates.map((date) => format(parseISO(date), "MMM d")),
        datasets: [
          {
            label: "Present",
            data: presentCounts,
            backgroundColor: "#10B981", // green-500
          },
          {
            label: "Time In Only",
            data: timeInOnlyCounts,
            backgroundColor: "#F59E0B", // yellow-500
          },
          {
            label: "Absent",
            data: absentCounts,
            backgroundColor: "#EF4444", // red-500
          },
        ],
      },
      duration: {
        labels: dates.map((date) => format(parseISO(date), "MMM d")),
        datasets: [
          {
            label: "Average Duration (minutes)",
            data: averageDurations,
            borderColor: "#3B82F6", // blue-500
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
    };
  }, [attendanceData]);

  // Student summary data
  const studentSummaries = useMemo(() => {
    if (attendanceData.length === 0) return [];

    return attendanceData.map((student) => {
      let presentCount = 0;
      let timeInOnlyCount = 0;
      let absentCount = 0;
      let totalDuration = 0;
      let durationCount = 0;

      student.records.forEach((record) => {
        if (record.status === "Present") {
          presentCount++;
          if (record.duration !== null) {
            totalDuration += record.duration;
            durationCount++;
          }
        } else if (record.status === "Time In Only") {
          timeInOnlyCount++;
        } else {
          absentCount++;
        }
      });

      const averageDuration =
        durationCount > 0
          ? `${Math.round(totalDuration / durationCount)} minutes`
          : "N/A";

      return {
        ...student,
        presentCount,
        timeInOnlyCount,
        absentCount,
        averageDuration,
        attendanceRate: `${Math.round(
          (presentCount / student.records.length) * 100
        )}%`,
      };
    });
  }, [attendanceData]);

  return (
    <div>
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

        {/* View mode toggle */}
        <div className="flex justify-between">
          
          <div className="gap-2 flex">
            <button
            onClick={() => setViewMode("table")}
            className={`px-4 py-2 rounded ${
              viewMode === "table" ? "bg-emerald-500 text-white" : "bg-gray-200"
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode("charts")}
            className={`px-4 py-2 rounded ${
              viewMode === "charts"
                ? "bg-emerald-500 text-white"
                : "bg-gray-200"
            }`}
          >
            Charts View
          </button>
          </div>
          

          <div>
            <button
              onClick={handleExportSummary}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Export Attendance Summary
            </button>
          </div>

        </div>
      </div>

      {/* Semester Configuration */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Semester Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Semester Start Date
            </label>
            <input
              type="date"
              value={semesterRange.start}
              onChange={(e) =>
                setSemesterRange({ ...semesterRange, start: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Semester End Date
            </label>
            <input
              type="date"
              value={semesterRange.end}
              onChange={(e) =>
                setSemesterRange({ ...semesterRange, end: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Add Holiday
            </label>
            <div className="flex">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <button
                onClick={handleAddHoliday}
                className="ml-2 px-3 py-2 bg-blue-500 text-white rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        {holidayDates.length > 0 && (
          <div className="mb-4">
            <h3 className="text-md font-medium">Holidays:</h3>
            <ul className="list-disc pl-5">
              {holidayDates.map((date) => (
                <li key={date} className="flex items-center">
                  <span>{date}</span>
                  <button
                    onClick={() => handleRemoveHoliday(date)}
                    className="ml-2 text-red-500 text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="text-sm">
            Total Valid Class Days:{" "}
            <span className="font-bold">{totalClassDays}</span>
          </p>
        </div>
      </div>

      {/* Class Summary Stats */}
      {classTimeStats && (
        <div className="bg-white p-4 rounded-lg shadow mb-6 ">
          <h2 className="text-xl font-bold mb-4">Class Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded">
              <h3 className="text-sm font-medium text-blue-800">
                Average Time In
              </h3>
              <p className="text-2xl font-bold">
                {classTimeStats.averageTimeIn || "N/A"}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <h3 className="text-sm font-medium text-purple-800">
                Average Time Out
              </h3>
              <p className="text-2xl font-bold">
                {classTimeStats.averageTimeOut || "N/A"}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <h3 className="text-sm font-medium text-green-800">
                Average Duration
              </h3>
              <p className="text-2xl font-bold">
                {classTimeStats.averageDuration || "N/A"}
              </p>
            </div>
            <div className="bg-amber-50 p-3 rounded">
              <h3 className="text-sm font-medium text-amber-800">
                Total Present Days
              </h3>
              <p className="text-2xl font-bold">
                {classTimeStats.totalPresent}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                              <span className="text-xs text-gray-500">
                                Duration:{" "}
                                {record.duration
                                  ? `${record.duration} mins`
                                  : "—"}
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

        </div>
      ) : (
        // Charts View
        <div className="space-y-6 grid grid-cols-2">
          {/* Attendance Summary Chart */}
          {aggregatedData && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Attendance Summary</h2>
              <Bar
                data={aggregatedData.attendance}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: "top" },
                    tooltip: {
                      callbacks: {
                        afterBody: (context) => {
                          const total =
                            context[0].parsed.y +
                            context[1]?.parsed?.y +
                            context[2]?.parsed?.y;
                          return `Total Students: ${total}`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true },
                  },
                }}
              />
            </div>
          )}

          {/* Duration Chart */}
          {aggregatedData && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Average Class Duration</h2>
              <Line
                data={aggregatedData.duration}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: "top" },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          return `${
                            context.dataset.label
                          }: ${context.parsed.y.toFixed(1)} mins`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          )}

          {/* Student Summary Table */}
          <div className="bg-white p-4 rounded-lg shadow overflow-x-auto md:col-span-2">
            <h2 className="text-xl font-bold mb-4">Student Summary</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time In Only
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg. Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studentSummaries.map((student) => (
                  <tr key={student.studentId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {student.studentName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {student.presentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                      {student.timeInOnlyCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {student.absentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.attendanceRate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.averageDuration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
