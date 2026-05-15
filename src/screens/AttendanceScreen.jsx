import { Alert as RNAlert } from "react-native";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
} from "react-native";

import { db, auth } from "../FireBase/FireBaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const isWeb = typeof document !== "undefined";

function useWebAlert() {
  const [alertConfig, setAlertConfig] = React.useState(null);

  const showAlert = React.useCallback((title, message, buttons) => {
    if (!isWeb) {
      RNAlert.alert(title, message, buttons);
      return;
    }
    const resolvedButtons =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: "OK", style: "default" }];
    setAlertConfig({ title, message, buttons: resolvedButtons });
  }, []);

  const handlePress = (btn) => {
    setAlertConfig(null);
    if (btn.onPress) btn.onPress();
  };

  const AlertModal = alertConfig ? (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => setAlertConfig(null)}
    >
      <View style={alertStyles.overlay}>
        <View style={alertStyles.dialog}>
          {alertConfig.title ? (
            <Text style={alertStyles.title}>{alertConfig.title}</Text>
          ) : null}
          {alertConfig.message ? (
            <Text style={alertStyles.message}>{alertConfig.message}</Text>
          ) : null}
          <View
            style={[
              alertStyles.buttonRow,
              alertConfig.buttons.length > 2 && alertStyles.buttonColumn,
            ]}
          >
            {alertConfig.buttons.map((btn, idx) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    alertStyles.btn,
                    isDestructive && alertStyles.btnDestructive,
                    isCancel && alertStyles.btnCancel,
                    alertConfig.buttons.length === 1 && alertStyles.btnSingle,
                    alertConfig.buttons.length > 2 && alertStyles.btnFull,
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      alertStyles.btnText,
                      isCancel && alertStyles.btnTextCancel,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, AlertModal };
}

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  dialog: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  buttonColumn: { flexDirection: "column", gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#CC0000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: "center",
  },
  btnSingle: { flex: 0, paddingHorizontal: 48 },
  btnFull: { flex: 0, width: "100%" },
  btnDestructive: { backgroundColor: "#8B0000" },
  btnCancel: { backgroundColor: "#F0F0F0" },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  btnTextCancel: { color: "#333" },
});

export default function AttendanceScreen({ route }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [activeTab, setActiveTab] = useState(
    Math.min(route?.params?.activeTab ?? 0, 1),
  );
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const [classes, setClasses] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [section, setSection] = useState("");
  const [schedule, setSchedule] = useState("");

  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentClassName, setCurrentClassName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [modalStudents, setModalStudents] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceMap, setAttendanceMap] = useState({});
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [attendanceDate] = useState(new Date().toISOString().split("T")[0]);

  const [classSummary, setClassSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    rate: 0,
  });
  const [studentAttendanceSummary, setStudentAttendanceSummary] = useState({});

  const [loading, setLoading] = useState(false);
  const [firestorePermissionError, setFirestorePermissionError] =
    useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (currentUser) loadClasses();
  }, [currentUser]);

  useEffect(() => {
    if (selectedClassId) loadStudents(selectedClassId, false);
  }, [selectedClassId]);

  const loadClassOverviewData = async (classId) => {
    if (!classId) return;
    try {
      const snap = await getDocs(
        query(collection(db, "attendance"), where("classId", "==", classId)),
      );

      let p = 0,
        a = 0,
        l = 0;
      const summary = {};

      snap.docs.forEach((d) => {
        const record = d.data();
        const sid = record.studentId;
        const status = record.status?.toLowerCase();

        if (!summary[sid]) {
          summary[sid] = { present: 0, absent: 0, late: 0, records: [] };
        }

        if (status === "present") {
          p++;
          summary[sid].present++;
        } else if (status === "absent") {
          a++;
          summary[sid].absent++;
        } else if (status === "late") {
          l++;
          summary[sid].late++;
        }

        summary[sid].records.push({ date: record.date, status: record.status });
      });

      Object.values(summary).forEach((entry) => {
        entry.records.sort((x, y) => y.date.localeCompare(x.date));
      });

      const total = p + a + l;
      const rate = total === 0 ? 0 : Math.round((p / total) * 100);

      setClassSummary({ present: p, absent: a, late: l, rate });
      setStudentAttendanceSummary(summary);
    } catch (error) {
      console.error("Failed to load class overview data:", error);
      setClassSummary({ present: 0, absent: 0, late: 0, rate: 0 });
      setStudentAttendanceSummary({});
    }
  };

  useEffect(() => {
    if (route?.params?.classId) {
      setSelectedClassId(route.params.classId);
      if (route.params.openStudentsModal) {
        setActiveTab(0);
        setShowStudentsModal(true);
        setCurrentClassId(route.params.classId);
        setCurrentClassName("");
        loadStudents(route.params.classId, true);
        loadClassOverviewData(route.params.classId);
      }
    }
  }, [route?.params?.classId, route?.params?.openStudentsModal]);

  useEffect(() => {
    if (classes.length > 0 && route?.params?.classId) {
      const selected = classes.find((cls) => cls.id === route.params.classId);
      if (selected) {
        setCurrentClassName(`${selected.subject_name} – ${selected.section}`);
      }
    }
  }, [classes, route?.params?.classId]);

  const loadClasses = async () => {
    const user = auth.currentUser || currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "classes"),
        where("teacherId", "==", user.uid),
      );
      const snapshot = await getDocs(q);
      const classList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClasses(classList);
    } catch (error) {
      console.error("Error loading classes:", error);
      if (
        error.code === "permission-denied" ||
        error.message?.includes("Missing or insufficient permissions")
      ) {
        setFirestorePermissionError(true);
      }
      showAlert("Error", "Failed to load classes");
    }
    setLoading(false);
  };

  const loadStudents = async (classId, forModal = false) => {
    try {
      const q = query(
        collection(db, "students"),
        where("classId", "==", classId),
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (forModal) {
        setModalStudents(list);
      } else {
        setStudents(list);
      }
    } catch (error) {
      console.error("Error loading students:", error);
      if (
        error.code === "permission-denied" ||
        error.message?.includes("Missing or insufficient permissions")
      ) {
        setFirestorePermissionError(true);
      }
      showAlert("Error", "Failed to load students");
    }
  };

  const deleteClass = async (classId) => {
    try {
      await deleteDoc(doc(db, "classes", classId));
      showAlert("Success", "Class deleted!");
      loadClasses();
      if (selectedClassId === classId) {
        setSelectedClassId(null);
        setStudents([]);
      }
    } catch {
      showAlert("Error", "Failed to delete class");
    }
  };

  const addStudent = async () => {
    if (!studentName || !studentNumber || !currentClassId) {
      showAlert("Error", "Please fill all fields");
      return;
    }
    try {
      const q = query(
        collection(db, "students"),
        where("classId", "==", currentClassId),
        where("student_number", "==", studentNumber),
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        showAlert("Error", "Student ID already exists in this class");
        return;
      }

      const studentDocId = `${currentClassId}_${studentNumber}_${studentName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "_");

      await setDoc(doc(db, "students", studentDocId), {
        classId: currentClassId,
        name: studentName,
        student_number: studentNumber,
        createdAt: serverTimestamp(),
      });
      showAlert("Success", "Student added!");
      setStudentName("");
      setStudentNumber("");
      loadStudents(currentClassId, true);
    } catch {
      showAlert("Error", "Failed to add student");
    }
  };

  const deleteStudent = async (studentId) => {
    try {
      await deleteDoc(doc(db, "students", studentId));
      showAlert("Success", "Student removed!");
      loadStudents(currentClassId, true);
    } catch {
      showAlert("Error", "Failed to remove student");
    }
  };

  const addNewClass = async () => {
    if (!subjectName || !section) {
      showAlert("Error", "Please enter subject name and section");
      return;
    }

    const user = auth.currentUser || currentUser;
    if (!user) {
      showAlert("Error", "You must be logged in to add a class");
      return;
    }

    try {
      const classDocId = `${user.uid}_${subjectName}_${section}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "_");

      await setDoc(doc(db, "classes", classDocId), {
        teacherId: user.uid,
        subject_name: subjectName,
        section,
        schedule: schedule || "",
        createdAt: serverTimestamp(),
      });
      showAlert("Success", "Class added successfully!");
      setSubjectName("");
      setSection("");
      setSchedule("");
      loadClasses();
    } catch (error) {
      console.error("Error adding class:", error);
      if (
        error.code === "permission-denied" ||
        error.message?.includes("Missing or insufficient permissions")
      ) {
        setFirestorePermissionError(true);
      }
      showAlert("Error", `Failed to add class: ${error.message}`);
    }
  };

  const saveAttendance = async () => {
    if (Object.keys(attendanceMap).length === 0) {
      showAlert("Warning", "No attendance marked yet");
      return;
    }
    if (!selectedClassId) {
      showAlert("Error", "Please select a class");
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser || currentUser;
      const promises = Object.entries(attendanceMap).map(
        async ([studentId, status]) => {
          const existing = await getDocs(
            query(
              collection(db, "attendance"),
              where("studentId", "==", studentId),
              where("classId", "==", selectedClassId),
              where("date", "==", attendanceDate),
            ),
          );
          for (const d of existing.docs)
            await deleteDoc(doc(db, "attendance", d.id));
          return addDoc(collection(db, "attendance"), {
            studentId,
            classId: selectedClassId,
            teacherId: user.uid,
            status,
            date: attendanceDate,
            createdAt: serverTimestamp(),
          });
        },
      );
      await Promise.all(promises);
      showAlert("Success", "Attendance saved!");
      setAttendanceMap({});
    } catch (error) {
      console.error("Error saving attendance:", error);
      if (
        error.code === "permission-denied" ||
        error.message?.includes("Missing or insufficient permissions")
      ) {
        setFirestorePermissionError(true);
      }
      showAlert("Error", "Failed to save attendance");
    }
    setLoading(false);
  };

  const toggleAttendance = (studentId, status) => {
    setAttendanceMap((prev) => {
      if (prev[studentId] === status) {
        const { [studentId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [studentId]: status };
    });
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_number?.includes(searchQuery),
  );

  if (firestorePermissionError) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.sectionTitle}>Firestore Permission Error</Text>
        <Text style={styles.comingSoon}>
          Your app is connected to Firestore, but your database rules currently
          block reading or writing data. Update your Firestore security rules in
          the Firebase console to allow authenticated users to access the
          collections.
        </Text>
      </View>
    );
  }

  if (!currentUser && !auth.currentUser) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.comingSoon}>
          Please log in to access attendance features
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Classes and Students</Text>
      </View>

      <View style={styles.tabContainer}>
        {["My Classes", "Mark Attendance"].map((label, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.tab, activeTab === index && styles.activeTab]}
            onPress={() => setActiveTab(index)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === index && styles.activeTabText,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 0 && (
          <View>
            <Text style={styles.sectionTitle}>Add New Class</Text>
            <TextInput
              style={styles.input}
              placeholder="Subject Name"
              value={subjectName}
              onChangeText={setSubjectName}
            />
            <TextInput
              style={styles.input}
              placeholder="Section (e.g. A-101)"
              value={section}
              onChangeText={setSection}
            />
            <TextInput
              style={styles.input}
              placeholder="Schedule (e.g. MW 8:00 AM)"
              value={schedule}
              onChangeText={setSchedule}
            />
            <TouchableOpacity style={styles.addButton} onPress={addNewClass}>
              <Text style={styles.buttonText}>ADD CLASS</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>
              Your Classes ({classes.length})
            </Text>
            {classes.length === 0 && (
              <Text style={styles.emptyText}>No classes yet.</Text>
            )}
            {classes.map((cls) => (
              <View key={cls.id} style={styles.classCard}>
                <Text style={styles.classTitle}>{cls.subject_name}</Text>
                <Text style={styles.classInfo}>Section: {cls.section}</Text>
                {cls.schedule ? (
                  <Text style={styles.classInfo}>Schedule: {cls.schedule}</Text>
                ) : null}
                <View style={styles.classActions}>
                  <TouchableOpacity
                    style={styles.studentsBtn}
                    onPress={() => {
                      setCurrentClassId(cls.id);
                      setCurrentClassName(
                        `${cls.subject_name} – ${cls.section}`,
                      );
                      setShowStudentsModal(true);
                      loadStudents(cls.id, true);
                      loadClassOverviewData(cls.id);
                    }}
                  >
                    <Text style={styles.studentsBtnText}>Students</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() =>
                      showAlert("Delete", "Delete this class?", [
                        { text: "Cancel" },
                        { text: "Delete", onPress: () => deleteClass(cls.id) },
                      ])
                    }
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 1 && (
          <View>
            <Text style={styles.sectionTitle}>Select Class</Text>
            <TouchableOpacity
              style={styles.pickerContainer}
              onPress={() => setShowClassPicker(!showClassPicker)}
            >
              <Text style={styles.pickerText}>
                {selectedClassId
                  ? `${classes.find((c) => c.id === selectedClassId)?.subject_name} – ${classes.find((c) => c.id === selectedClassId)?.section}`
                  : "-- Select Class --"}
              </Text>
              <Text style={styles.pickerArrow}>
                {showClassPicker ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>
            {showClassPicker && (
              <View style={styles.pickerDropdown}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={styles.pickerOption}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setShowClassPicker(false);
                      setAttendanceMap({});
                    }}
                  >
                    <Text
                      style={styles.pickerOptionText}
                    >{`${cls.subject_name} – ${cls.section}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedClassId && (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {filteredStudents.length === 0 && (
                  <Text style={styles.emptyText}>
                    No students yet. Add them in My Classes.
                  </Text>
                )}
                <ScrollView style={styles.studentList} nestedScrollEnabled>
                  {filteredStudents.map((student) => (
                    <View key={student.id} style={styles.studentRow}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentNumber}>
                          ID: {student.student_number}
                        </Text>
                      </View>
                      <View style={styles.attendanceButtons}>
                        {["Present", "Absent", "Late"].map((status) => {
                          const isSelected =
                            attendanceMap[student.id] === status;
                          const colors = {
                            Present: { active: "#16A34A", passive: "#E0F2E0" },
                            Absent: { active: "#CC0000", passive: "#FEE2E2" },
                            Late: { active: "#D97706", passive: "#FEF3C7" },
                          };
                          return (
                            <TouchableOpacity
                              key={status}
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: isSelected
                                    ? colors[status].active
                                    : colors[status].passive,
                                },
                              ]}
                              onPress={() =>
                                toggleAttendance(student.id, status)
                              }
                            >
                              <Text
                                style={{
                                  color: isSelected ? "#FFF" : "#555",
                                  fontWeight: "bold",
                                  fontSize: 12,
                                }}
                              >
                                {status[0]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveAttendance}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? "SAVING..." : "SAVE ATTENDANCE"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showStudentsModal}
        animationType="slide"
        onRequestClose={() => setShowStudentsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{currentClassName}</Text>
              <Text style={styles.classScheduleText}>
                {classes.find((c) => c.id === currentClassId)?.schedule ||
                  "No schedule set"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowStudentsModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.classOverviewHeading}>Class Overview</Text>
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

            <Text style={styles.sectionTitle}>Add New Student</Text>
            <TextInput
              style={styles.input}
              placeholder="Student Name"
              value={studentName}
              onChangeText={setStudentName}
            />
            <TextInput
              style={styles.input}
              placeholder="Student ID Number"
              value={studentNumber}
              onChangeText={setStudentNumber}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.addButton} onPress={addStudent}>
              <Text style={styles.buttonText}>ADD STUDENT</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>
              Students ({modalStudents.length})
            </Text>
            {modalStudents.length === 0 && (
              <Text style={styles.emptyText}>No students yet.</Text>
            )}
            {modalStudents.map((student) => {
              const summary = studentAttendanceSummary[student.id] || {
                present: 0,
                absent: 0,
                late: 0,
                records: [],
              };
              return (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentId}>
                      ID: {student.student_number}
                    </Text>
                    <View style={styles.studentTotalsRow}>
                      <Text style={[styles.studentTotal, { color: "#16A34A" }]}>
                        P: {summary.present}
                      </Text>
                      <Text style={[styles.studentTotal, { color: "#CC0000" }]}>
                        A: {summary.absent}
                      </Text>
                      <Text style={[styles.studentTotal, { color: "#D97706" }]}>
                        L: {summary.late}
                      </Text>
                    </View>
                    {summary.records.length > 0 ? (
                      <Text style={styles.attendanceHistory}>
                        {summary.records
                          .slice(0, 3)
                          .map(
                            (rec, idx) =>
                              `${rec.date} ${rec.status}${
                                idx < Math.min(summary.records.length, 3) - 1
                                  ? " · "
                                  : ""
                              }`,
                          )}
                      </Text>
                    ) : (
                      <Text style={styles.attendanceHistory}>
                        No attendance records yet.
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteStudentBtn}
                    onPress={() =>
                      showAlert("Delete", "Remove this student?", [
                        { text: "Cancel" },
                        {
                          text: "Remove",
                          onPress: () => deleteStudent(student.id),
                        },
                      ])
                    }
                  >
                    <Text style={styles.deleteStudentBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {AlertModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    backgroundColor: "#CC0000",
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    padding: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  activeTab: {
    backgroundColor: "#CC0000",
    borderColor: "#CC0000",
  },
  tabText: { color: "#CC0000", fontWeight: "bold", fontSize: 12 },
  activeTabText: { color: "#FFFFFF" },
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#CC0000",
    marginVertical: 12,
  },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 12,
  },
  buttonText: { color: "#FFF", fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#777", marginVertical: 16 },
  classCard: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  classTitle: { fontSize: 16, fontWeight: "bold" },
  classInfo: { fontSize: 13, color: "#555", marginTop: 4 },
  classActions: { flexDirection: "row", marginTop: 12, gap: 8 },
  studentsBtn: {
    backgroundColor: "#1A3A8F",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  studentsBtnText: { color: "#FFF", textAlign: "center" },
  deleteBtn: {
    backgroundColor: "#CC0000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  deleteBtnText: { color: "#FFF", textAlign: "center" },
  pickerContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 8,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  searchInput: {
    backgroundColor: "#F5F5F5",
    padding: 14,
    borderRadius: 8,
    marginVertical: 8,
  },
  studentList: { maxHeight: 400 },
  studentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  studentName: { fontSize: 15, fontWeight: "600" },
  studentNumber: { fontSize: 13, color: "#666" },
  attendanceButtons: { flexDirection: "row", gap: 6 },
  statusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  saveButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: "#FFF" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#CC0000",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  modalTitleRow: { flex: 1 },
  classScheduleText: { color: "#FFF", fontSize: 12, marginTop: 4 },
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
  classOverviewHeading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#CC0000",
    marginBottom: 12,
  },
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
  studentCard: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  studentInfo: { flex: 1, marginRight: 12 },
  studentTotalsRow: { flexDirection: "row", marginTop: 8, flexWrap: "wrap" },
  studentTotal: { fontSize: 13, fontWeight: "bold", marginRight: 16 },
  attendanceHistory: { marginTop: 8, fontSize: 12, color: "#555" },
  studentId: { fontSize: 14, color: "#666", marginTop: 4 },
  deleteStudentBtn: {
    backgroundColor: "#CC0000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteStudentBtnText: { color: "#FFF", fontSize: 12 },
  comingSoon: { textAlign: "center", color: "#777", marginTop: 8 },
});
