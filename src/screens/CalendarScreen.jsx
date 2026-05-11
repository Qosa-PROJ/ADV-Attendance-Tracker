// src/screens/CalendarScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../FireBase/FireBaseConfig";

function monthDays(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function pad(value) {
  return value.toString().padStart(2, "0");
}

export default function CalendarScreen() {
  const today = new Date();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = monthDays(year, month);
  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error);
    }
  }, [error]);

  const loadAttendanceData = async () => {
    if (!selectedClassId) {
      setLoading(false);
      setAttendanceMap({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const startDate = `${year}-${pad(month + 1)}-01`;
      const endDate = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;
      console.log(
        `Loading attendance for ${startDate} to ${endDate}, classId: ${selectedClassId}`,
      );
      const q = query(
        collection(db, "attendance"),
        where("classId", "==", selectedClassId),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
      );
      const snap = await getDocs(q);
      const map = {};
      console.log(`Found ${snap.docs.length} attendance records`);
      snap.docs.forEach((docItem) => {
        const rec = docItem.data();
        const key = `${rec.studentId}|${rec.date}`;
        map[key] = rec.status;
        console.log(`Added: ${key} = ${rec.status}`);
      });
      setAttendanceMap(map);
    } catch (error) {
      console.error("Failed to load attendance", error);
      if (error.message && error.message.includes("index")) {
        setError(
          "Composite index required. Check Firebase Console for index creation link.",
        );
      } else {
        setError(error.message || "Failed to load attendance");
      }
    }
    setLoading(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log("Calendar focused - reloading classes and attendance");
      loadClasses();
      loadAttendanceData();
      return () => {};
    }, [selectedClassId, year, month, daysInMonth]),
  );

  useEffect(() => {
    if (selectedClassId) {
      loadStudents();
      loadAttendanceData();
    }
  }, [selectedClassId, currentDate]);

  const loadClasses = async () => {
    try {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, "classes"),
        where("teacherId", "==", auth.currentUser.uid),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClasses(list);
      if (list.length === 0) {
        setSelectedClassId(null);
        return;
      }
      if (!selectedClassId || !list.some((cls) => cls.id === selectedClassId)) {
        setSelectedClassId(list[0].id);
      }
    } catch (error) {
      console.error("Failed to load classes", error);
    }
  };

  const loadStudents = async () => {
    if (!selectedClassId) return;
    try {
      const q = query(
        collection(db, "students"),
        where("classId", "==", selectedClassId),
      );
      const snap = await getDocs(q);
      const studentList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log(
        `Loaded ${studentList.length} students for class ${selectedClassId}`,
      );
      setStudents(studentList);
    } catch (error) {
      console.error("Failed to load students", error);
    }
  };

  const presentBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "present") return { label: "P", color: "#16A34A" };
    if (s === "absent") return { label: "A", color: "#CC0000" };
    if (s === "late") return { label: "L", color: "#D97706" };
    return { label: "", color: "#999" };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Sheet</Text>
        <Text style={styles.subtitle}>{monthLabel}</Text>
      </View>

      <View style={styles.classRow}>
        <Text style={styles.classLabel}>Class:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[
                styles.classButton,
                selectedClassId === cls.id && styles.classButtonActive,
              ]}
              onPress={() => setSelectedClassId(cls.id)}
            >
              <Text
                style={[
                  styles.classButtonText,
                  selectedClassId === cls.id && styles.classButtonTextActive,
                ]}
              >
                {cls.subject_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          color="#CC0000"
          size="large"
          style={{ marginTop: 32 }}
        />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Text style={styles.errorSubtext}>
            If you see "index required", create a composite index in Firebase
            Console:
          </Text>
          <Text style={styles.errorSubtext}>
            Collection: attendance | Fields: classId (Asc), date (Asc)
          </Text>
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No classes created yet.</Text>
          <Text style={styles.emptySubtext}>
            Create a class first in the Attendance tab, then return here to view
            it.
          </Text>
        </View>
      ) : (
        <View style={styles.tableWrapper}>
          <ScrollView horizontal>
            <View>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.cell, styles.stickyCell, styles.idCell]}>
                  <Text style={styles.headerText}>Student ID</Text>
                </View>
                <View style={[styles.cell, styles.stickyCell, styles.nameCell]}>
                  <Text style={styles.headerText}>Name</Text>
                </View>
                {Array.from({ length: daysInMonth }, (_, idx) => (
                  <View key={idx + 1} style={[styles.cell, styles.dateCell]}>
                    <Text style={styles.headerText}>{idx + 1}</Text>
                  </View>
                ))}
                <View style={[styles.cell, styles.totalCell]}>
                  <Text style={styles.headerText}>Totals</Text>
                </View>
              </View>

              {students.map((student) => {
                const totals = { present: 0, absent: 0, late: 0 };
                return (
                  <View key={student.id} style={styles.tableRow}>
                    <View
                      style={[styles.cell, styles.stickyCell, styles.idCell]}
                    >
                      <Text style={styles.cellText}>
                        {student.student_number}
                      </Text>
                    </View>
                    <View
                      style={[styles.cell, styles.stickyCell, styles.nameCell]}
                    >
                      <Text style={styles.cellText} numberOfLines={1}>
                        {student.name}
                      </Text>
                    </View>
                    {Array.from({ length: daysInMonth }, (_, idx) => {
                      const day = idx + 1;
                      const date = `${year}-${pad(month + 1)}-${pad(day)}`;
                      const key = `${student.id}|${date}`;
                      const status = attendanceMap[key] || "";
                      const statusLower = (status || "").toLowerCase();
                      if (statusLower === "present") totals.present += 1;
                      if (statusLower === "absent") totals.absent += 1;
                      if (statusLower === "late") totals.late += 1;
                      const badge = presentBadge(status);
                      return (
                        <View
                          key={key}
                          style={[
                            styles.cell,
                            styles.dateCell,
                            status ? styles.activeCell : styles.emptyCell,
                          ]}
                        >
                          <Text
                            style={[
                              styles.cellText,
                              status
                                ? { color: badge.color, fontWeight: "bold" }
                                : null,
                            ]}
                          >
                            {badge.label}
                          </Text>
                        </View>
                      );
                    })}
                    <View style={[styles.cell, styles.totalCell]}>
                      <Text style={[styles.cellText, styles.totalText]}>
                        P:{totals.present} A:{totals.absent} L:{totals.late}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
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
  title: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  subtitle: { color: "#FFCCCC", marginTop: 4, fontSize: 13 },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9F9F9",
  },
  classLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginRight: 12,
    color: "#333",
  },
  classButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  classButtonActive: { backgroundColor: "#CC0000" },
  classButtonText: { color: "#333" },
  classButtonTextActive: { color: "#FFF" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonText: { fontSize: 22, color: "#333" },
  monthLabel: { fontSize: 16, fontWeight: "bold", color: "#333" },
  tableWrapper: { flex: 1, paddingHorizontal: 8 },
  tableRow: { flexDirection: "row", alignItems: "center" },
  tableHeader: {
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderBottomColor: "#DDD",
  },
  cell: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  stickyCell: { backgroundColor: "#F9FAFB" },
  idCell: { width: 90 },
  nameCell: { width: 140 },
  dateCell: { width: 40, minWidth: 40, height: 40 },
  totalCell: { width: 130, minWidth: 130 },
  headerText: { fontSize: 12, fontWeight: "bold", color: "#111" },
  cellText: { fontSize: 12, color: "#111" },
  activeCell: { backgroundColor: "#FEF3C7" },
  emptyCell: { backgroundColor: "#FFF" },
  totalText: { fontWeight: "bold" },
  errorContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#CC0000",
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
