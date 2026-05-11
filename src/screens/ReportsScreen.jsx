// src/screens/ReportsScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../FireBase/FireBaseConfig";

const ABSENT_FLAG_THRESHOLD = 3;

export default function ReportsScreen() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [overallStats, setOverallStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    total: 0,
  });
  const [flaggedStudents, setFlaggedStudents] = useState([]);
  const [classReport, setClassReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (classes.length > 0) {
      loadOverallStats();
      loadFlaggedStudents();
    }
  }, [classes]);

  useEffect(() => {
    if (selectedClassId) loadClassReport(selectedClassId);
  }, [selectedClassId]);

  const loadClasses = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    try {
      const snap = await getDocs(
        query(
          collection(db, "classes"),
          where("teacherId", "==", auth.currentUser.uid),
        ),
      );
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getAttendanceForClasses = async (classIds) => {
    if (classIds.length === 0) return [];
    let all = [];
    for (let i = 0; i < classIds.length; i += 30) {
      const chunk = classIds.slice(i, i + 30);
      const snap = await getDocs(
        query(collection(db, "attendance"), where("classId", "in", chunk)),
      );
      all = [...all, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))];
    }
    return all;
  };

  const loadOverallStats = async () => {
    const records = await getAttendanceForClasses(classes.map((c) => c.id));
    let present = 0,
      absent = 0,
      late = 0;
    for (const r of records) {
      const s = r.status?.toLowerCase();
      if (s === "present") present++;
      else if (s === "absent") absent++;
      else if (s === "late") late++;
    }
    setOverallStats({ present, absent, late, total: present + absent + late });
  };

  const loadFlaggedStudents = async () => {
    const records = await getAttendanceForClasses(classes.map((c) => c.id));
    const absenceCount = {};
    for (const r of records) {
      if (r.status?.toLowerCase() === "absent")
        absenceCount[r.studentId] = (absenceCount[r.studentId] || 0) + 1;
    }
    const flaggedIds = Object.entries(absenceCount)
      .filter(([, count]) => count >= ABSENT_FLAG_THRESHOLD)
      .map(([id]) => id);
    if (flaggedIds.length === 0) {
      setFlaggedStudents([]);
      return;
    }

    // Fetch all students from all classes instead of using __name__
    let studentDocs = [];
    for (let i = 0; i < classes.length; i += 10) {
      const classChunk = classes.slice(i, i + 10);
      const classIds = classChunk.map((c) => c.id);
      const snap = await getDocs(
        query(collection(db, "students"), where("classId", "in", classIds)),
      );
      studentDocs = [
        ...studentDocs,
        ...snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      ];
    }

    // Filter locally to get only flagged students
    const flagged = studentDocs
      .filter((s) => flaggedIds.includes(s.id))
      .map((s) => ({
        ...s,
        absences: absenceCount[s.id],
        className:
          classes.find((c) => c.id === s.classId)?.subject_name || "Unknown",
      }))
      .sort((a, b) => b.absences - a.absences);
    setFlaggedStudents(flagged);
  };

  const loadClassReport = async (classId) => {
    setClassReport(null);
    try {
      const cls = classes.find((c) => c.id === classId);
      const studentsSnap = await getDocs(
        query(collection(db, "students"), where("classId", "==", classId)),
      );
      const students = studentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const attSnap = await getDocs(
        query(collection(db, "attendance"), where("classId", "==", classId)),
      );
      const records = attSnap.docs.map((d) => d.data());

      const studentStats = students
        .map((s) => {
          const mine = records.filter((r) => r.studentId === s.id);
          const present = mine.filter(
            (r) => r.status?.toLowerCase() === "present",
          ).length;
          const absent = mine.filter(
            (r) => r.status?.toLowerCase() === "absent",
          ).length;
          const late = mine.filter(
            (r) => r.status?.toLowerCase() === "late",
          ).length;
          const total = mine.length;
          const rate = total > 0 ? Math.round((present / total) * 100) : null;
          return { ...s, present, absent, late, total, rate };
        })
        .sort((a, b) => b.absent - a.absent);

      const totalPresent = records.filter(
        (r) => r.status?.toLowerCase() === "present",
      ).length;
      const overallRate =
        records.length > 0
          ? Math.round((totalPresent / records.length) * 100)
          : null;
      setClassReport({
        cls,
        studentStats,
        overallRate,
        totalRecords: records.length,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const rateColor = (rate) => {
    if (rate === null) return "#777";
    if (rate >= 80) return "#16A34A";
    if (rate >= 60) return "#D97706";
    return "#CC0000";
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator color="#CC0000" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance Reports</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Overall Stats */}
        <Text style={styles.sectionTitle}>Overall Attendance Rate</Text>
        {overallStats.total === 0 ? (
          <Text style={styles.noData}>No attendance records yet.</Text>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: "#16A34A" }]}>
                  {overallStats.present}
                </Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: "#CC0000" }]}>
                  {overallStats.absent}
                </Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: "#D97706" }]}>
                  {overallStats.late}
                </Text>
                <Text style={styles.statLabel}>Late</Text>
              </View>
            </View>
            <View style={styles.rateBar}>
              <View
                style={[
                  styles.rateSegment,
                  { flex: overallStats.present, backgroundColor: "#16A34A" },
                ]}
              />
              <View
                style={[
                  styles.rateSegment,
                  { flex: overallStats.late, backgroundColor: "#D97706" },
                ]}
              />
              <View
                style={[
                  styles.rateSegment,
                  { flex: overallStats.absent, backgroundColor: "#CC0000" },
                ]}
              />
            </View>
            <Text style={styles.rateCaption}>
              {Math.round((overallStats.present / overallStats.total) * 100)}%
              overall attendance
            </Text>
          </>
        )}

        {/* Flagged Students */}
        <Text style={styles.sectionTitle}>
          Flagged Students (≥{ABSENT_FLAG_THRESHOLD} Absences)
        </Text>
        {flaggedStudents.length === 0 ? (
          <Text style={styles.noData}>No flagged students — great job!</Text>
        ) : (
          flaggedStudents.map((s) => (
            <View key={s.id} style={styles.flagCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.flagName}>{s.name}</Text>
                <Text style={styles.flagSub}>
                  ID: {s.student_number} · {s.className}
                </Text>
              </View>
              <View style={styles.flagBadge}>
                <Text style={styles.flagBadgeText}>{s.absences} absent</Text>
              </View>
            </View>
          ))
        )}

        {/* Per-Class Report */}
        <Text style={styles.sectionTitle}>Reports by Class</Text>
        <TouchableOpacity
          style={styles.pickerContainer}
          onPress={() => setShowPicker(!showPicker)}
        >
          <Text style={styles.pickerText}>
            {selectedClassId
              ? `${classes.find((c) => c.id === selectedClassId)?.subject_name} – ${classes.find((c) => c.id === selectedClassId)?.section}`
              : "-- Select a Class --"}
          </Text>
          <Text style={styles.pickerArrow}>{showPicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {showPicker && (
          <View style={styles.pickerDropdown}>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={styles.pickerOption}
                onPress={() => {
                  setSelectedClassId(cls.id);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.pickerOptionText}>
                  {cls.subject_name} – {cls.section}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedClassId && !classReport && (
          <ActivityIndicator color="#CC0000" style={{ marginVertical: 20 }} />
        )}

        {classReport && (
          <View style={styles.classReportContainer}>
            <Text style={styles.classReportTitle}>
              {classReport.cls?.subject_name} – {classReport.cls?.section}
            </Text>
            <Text style={styles.classReportSub}>
              {classReport.totalRecords} records ·{" "}
              {classReport.overallRate !== null
                ? `${classReport.overallRate}% attendance`
                : "No records yet"}
            </Text>
            {classReport.studentStats.length === 0 ? (
              <Text style={styles.noData}>No students in this class.</Text>
            ) : (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Student</Text>
                  <Text style={[styles.tableCell, styles.tableCellCenter]}>
                    P
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellCenter]}>
                    A
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellCenter]}>
                    L
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>
                    Rate
                  </Text>
                </View>
                {classReport.studentStats.map((s) => (
                  <View key={s.id} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tableStudentName}>{s.name}</Text>
                      <Text style={styles.tableStudentId}>
                        #{s.student_number}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellCenter,
                        { color: "#16A34A" },
                      ]}
                    >
                      {s.present}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellCenter,
                        { color: "#CC0000" },
                      ]}
                    >
                      {s.absent}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellCenter,
                        { color: "#D97706" },
                      ]}
                    >
                      {s.late}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellRight,
                        { color: rateColor(s.rate), fontWeight: "bold" },
                      ]}
                    >
                      {s.rate !== null ? `${s.rate}%` : "—"}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: "#CC0000", padding: 20, paddingTop: 48 },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#CC0000",
    marginTop: 20,
    marginBottom: 12,
  },
  noData: { textAlign: "center", color: "#777", marginVertical: 12 },
  statsRow: { flexDirection: "row", marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    padding: 16,
    margin: 4,
    borderRadius: 8,
    alignItems: "center",
  },
  statNum: { fontSize: 26, fontWeight: "bold" },
  statLabel: { fontSize: 11, color: "#555", marginTop: 4 },
  rateBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "#EEE",
    marginBottom: 8,
  },
  rateSegment: { height: 10 },
  rateCaption: {
    fontSize: 12,
    color: "#777",
    textAlign: "center",
    marginBottom: 8,
  },
  flagCard: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#CC0000",
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  flagName: { fontSize: 15, fontWeight: "bold" },
  flagSub: { fontSize: 12, color: "#666", marginTop: 2 },
  flagBadge: {
    backgroundColor: "#CC0000",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  flagBadgeText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  pickerContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pickerText: { fontSize: 15, color: "#333" },
  pickerArrow: { fontSize: 16, color: "#666" },
  pickerDropdown: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  pickerOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  pickerOptionText: { fontSize: 15, color: "#333" },
  classReportContainer: {
    backgroundColor: "#F9F9F9",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  classReportTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  classReportSub: {
    fontSize: 12,
    color: "#777",
    marginBottom: 16,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#CC0000",
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  tableCell: { flex: 1, fontSize: 13, color: "#333" },
  tableCellCenter: { textAlign: "center" },
  tableCellRight: { textAlign: "right" },
  tableStudentName: { fontSize: 14, fontWeight: "600" },
  tableStudentId: { fontSize: 11, color: "#888" },
});
