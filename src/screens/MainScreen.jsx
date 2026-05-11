// src/screens/MainScreen.jsx
import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";

export default function MainScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/attendance_logo.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Attendance Tracker</Text>
      <Text style={styles.subtitle}>
        Manage your classes and students with ease.{"\n"}
        Quick, reliable, and secure.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.buttonText}>GET STARTED</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logo: { width: 126, height: 162, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "bold", color: "#CC0000", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#555555", textAlign: "center", marginBottom: 48, lineHeight: 20 },
  button: { backgroundColor: "#CC0000", width: "100%", padding: 16, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
});