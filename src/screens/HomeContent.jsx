// src/screens/HomeContent.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../FireBase/FireBaseConfig";
import { useFocusEffect } from "@react-navigation/native";

export default function HomeContent({ navigation }) {
  const [userName, setUserName] = useState("Teacher");
  const [classes, setClasses] = useState([]);
  const [present, setPresent] = useState(0);
  const [absent, setAbsent] = useState(0);
  const [late, setLate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showClassModal, setShowClassModal] = useState(false);
  const [activeClass, setActiveClass] = useState(null);
  const [classSummary, setClassSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    rate: 0,
  });
  const [classStudents, setClassStudents] = useState([]);
  const [studentAttendanceSummary, setStudentAttendanceSummary] = useState({});
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dateStr = selectedDate.toISOString().split("T")[0];
  const dateFormatted = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (auth.currentUser) {
      setUserName(
        auth.currentUser.displayName ||
          auth.currentUser.email?.split("@")[0] ||
          "Teacher",
      );
    }
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "classes"),
      where("teacherId", "==", auth.currentUser.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const classList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClasses(classList);
      },
      (error) => {
        console.error("Error listening to classes:", error);
      },
    );

    return unsubscribe; // Cleanup on unmount
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (auth.currentUser) {
        setLoading(true);
        loadSummary();
      }
    }, []),
  );

  const loadClassOverview = async (cls) => {
    setActiveClass(cls);
    setShowClassModal(true);
    setLoadingOverview(true);

    try {
      const studentSnap = await getDocs(
        query(collection(db, "students"), where("classId", "==", cls.id)),
      );
      const students = studentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClassStudents(students);

      const attendanceSnap = await getDocs(
        query(collection(db, "attendance"), where("classId", "==", cls.id)),
      );
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      const attendanceByStudent = {};

      attendanceSnap.docs.forEach((doc) => {
        const record = doc.data();
        const studentId = record.studentId;
        const status = record.status?.toLowerCase();
        if (!attendanceByStudent[studentId]) {
          attendanceByStudent[studentId] = {
            present: 0,
            absent: 0,
            late: 0,
            records: [],
          };
        }
        if (status === "present") presentCount += 1;
        else if (status === "absent") absentCount += 1;
        else if (status === "late") lateCount += 1;

        if (status === "present") attendanceByStudent[studentId].present += 1;
        else if (status === "absent")
          attendanceByStudent[studentId].absent += 1;
        else if (status === "late") attendanceByStudent[studentId].late += 1;

        attendanceByStudent[studentId].records.push({
          date: record.date,
          status: record.status,
        });
      });

      Object.values(attendanceByStudent).forEach((item) => {
        item.records.sort((a, b) => b.date.localeCompare(a.date));
      });

      const totalRecords = presentCount + absentCount + lateCount;
      const rate =
        totalRecords === 0
          ? 0
          : Math.round((presentCount / totalRecords) * 100);
      setClassSummary({
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        rate,
      });
      setStudentAttendanceSummary(attendanceByStudent);
    } catch (error) {
      console.error("Failed to load class overview", error);
      setClassStudents([]);
      setStudentAttendanceSummary({});
      setClassSummary({ present: 0, absent: 0, late: 0, rate: 0 });
    }

    setLoadingOverview(false);
  };

  const closeClassModal = () => {
    setShowClassModal(false);
    setActiveClass(null);
    setClassStudents([]);
    setStudentAttendanceSummary({});
    setClassSummary({ present: 0, absent: 0, late: 0, rate: 0 });
  };

  const loadSummary = async (date = selectedDate) => {
    if (!auth.currentUser) return;

    try {
      const classSnap = await getDocs(
        query(
          collection(db, "classes"),
          where("teacherId", "==", auth.currentUser.uid),
        ),
      );
      const classIds = classSnap.docs.map((d) => d.id);
      if (classIds.length === 0) {
        setPresent(0);
        setAbsent(0);
        setLate(0);
        setLoading(false);
        return;
      }

      const dateString = date.toISOString().split("T")[0];
      let allRecords = [];
      const chunkSize = 30;
      for (let i = 0; i < classIds.length; i += chunkSize) {
        const chunk = classIds.slice(i, i + chunkSize);
        const snap = await getDocs(
          query(
            collection(db, "attendance"),
            where("classId", "in", chunk),
            where("date", "==", dateString),
          ),
        );
        allRecords = [...allRecords, ...snap.docs.map((d) => d.data())];
      }

      let p = 0,
        a = 0,
        l = 0;
      for (const rec of allRecords) {
        const s = rec.status?.toLowerCase();
        if (s === "present") p++;
        else if (s === "absent") a++;
        else if (s === "late") l++;
      }
      setPresent(p);
      setAbsent(a);
      setLate(l);
    } catch (error) {
      console.error("Error loading today summary:", error);
      setPresent(0);
      setAbsent(0);
      setLate(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Good day, {userName}!</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
          <Text style={styles.date}>{dateFormatted} 📅</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Today's Overall Summary</Text>

        {loading ? (
          <ActivityIndicator color="#CC0000" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.summaryContainer}>
            <View style={styles.card}>
              <Text style={[styles.count, { color: "#16A34A" }]}>
                {present}
              </Text>
              <Text style={styles.label}>Present</Text>
            </View>
            <View style={styles.card}>
              <Text style={[styles.count, { color: "#CC0000" }]}>{absent}</Text>
              <Text style={styles.label}>Absent</Text>
            </View>
            <View style={styles.card}>
              <Text style={[styles.count, { color: "#D97706" }]}>{late}</Text>
              <Text style={styles.label}>Late</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>My Classes ({classes.length})</Text>
        {!loading && classes.length === 0 && (
          <Text style={styles.noClassText}>
            No classes yet. Go to Attendance to add one.
          </Text>
        )}
        {classes.map((cls) => (
          <TouchableOpacity
            key={cls.id}
            style={styles.classCard}
            activeOpacity={0.8}
            onPress={() => loadClassOverview(cls)}
          >
            <Text style={styles.classTitle}>{cls.subject_name}</Text>
            <Text style={styles.classSubtitle}>Section: {cls.section}</Text>
            {cls.schedule ? (
              <Text style={styles.classSched}>Schedule: {cls.schedule}</Text>
            ) : null}
          </TouchableOpacity>
        ))}

        <Modal
          visible={showClassModal}
          animationType="slide"
          onRequestClose={closeClassModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {activeClass?.subject_name} – {activeClass?.section}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {activeClass?.schedule || "No schedule set"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeClassModal}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.sectionTitle}>Class Overview</Text>
              {loadingOverview ? (
                <ActivityIndicator
                  color="#CC0000"
                  style={{ marginVertical: 20 }}
                />
              ) : (
                <View>
                  <View style={styles.summaryContainer}>
                    <View style={styles.summaryCard}>
                      <Text style={[styles.summaryCount, { color: "#16A34A" }]}>
                        {classSummary.present}
                      </Text>
                      <Text style={styles.summaryLabel}>Present</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={[styles.summaryCount, { color: "#CC0000" }]}>
                        {classSummary.absent}
                      </Text>
                      <Text style={styles.summaryLabel}>Absent</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={[styles.summaryCount, { color: "#D97706" }]}>
                        {classSummary.late}
                      </Text>
                      <Text style={styles.summaryLabel}>Late</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={[styles.summaryCount, { color: "#1D4ED8" }]}>
                        {classSummary.rate}%
                      </Text>
                      <Text style={styles.summaryLabel}>Rate</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>
                    Students in this class
                  </Text>
                  {classStudents.length === 0 ? (
                    <Text style={styles.noClassText}>
                      No students found for this class.
                    </Text>
                  ) : (
                    classStudents.map((student) => {
                      const summary = studentAttendanceSummary[student.id] || {
                        present: 0,
                        absent: 0,
                        late: 0,
                        records: [],
                      };
                      return (
                        <View key={student.id} style={styles.studentRowCard}>
                          <View style={styles.studentRowLeft}>
                            <Text style={styles.studentName}>
                              {student.name}
                            </Text>
                            <Text style={styles.studentId}>
                              ID: {student.student_number}
                            </Text>
                            <View style={styles.studentTotalsRow}>
                              <Text
                                style={[
                                  styles.studentTotal,
                                  { color: "#16A34A" },
                                ]}
                              >
                                P: {summary.present}
                              </Text>
                              <Text
                                style={[
                                  styles.studentTotal,
                                  { color: "#CC0000" },
                                ]}
                              >
                                A: {summary.absent}
                              </Text>
                              <Text
                                style={[
                                  styles.studentTotal,
                                  { color: "#D97706" },
                                ]}
                              >
                                L: {summary.late}
                              </Text>
                            </View>
                            <Text style={styles.attendanceHistory}>
                              {summary.records.length > 0
                                ? summary.records
                                    .slice(0, 4)
                                    .map(
                                      (record, index) =>
                                        `${record.date} ${record.status}${index < Math.min(summary.records.length, 4) - 1 ? " · " : ""}`,
                                    )
                                : "No attendance records yet."}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setSelectedDate(selectedDate);
              loadSummary(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    backgroundColor: "#CC0000",
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  welcome: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  date: { color: "#FFCCCC", fontSize: 13, marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#CC0000",
    marginBottom: 12,
    marginTop: 8,
  },
  summaryContainer: { flexDirection: "row", marginBottom: 24 },
  card: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    padding: 16,
    margin: 4,
    borderRadius: 8,
    alignItems: "center",
  },
  count: { fontSize: 28, fontWeight: "bold" },
  label: { fontSize: 11, color: "#555555", marginTop: 4 },
  classCard: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  classTitle: { fontSize: 16, fontWeight: "bold" },
  classSubtitle: { fontSize: 13, color: "#555" },
  classSched: { fontSize: 12, color: "#777", marginTop: 2 },
  noClassText: { textAlign: "center", color: "#777", marginTop: 20 },
  modalContainer: { flex: 1, backgroundColor: "#FFF" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#CC0000",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  modalSubtitle: { fontSize: 12, color: "#FFF", marginTop: 4 },
  closeButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: { fontSize: 18, color: "#FFF" },
  modalContent: { flex: 1, padding: 16 },
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  summaryCount: { fontSize: 24, fontWeight: "bold" },
  summaryLabel: { fontSize: 12, color: "#555", marginTop: 6 },
  studentRowCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  studentRowLeft: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "bold" },
  studentId: { fontSize: 13, color: "#555", marginTop: 4 },
  studentTotalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  studentTotal: { fontSize: 13, fontWeight: "bold", marginRight: 16 },
  attendanceHistory: { marginTop: 8, fontSize: 12, color: "#555" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  modalClose: { fontSize: 20, color: "#666", padding: 4 },
});
