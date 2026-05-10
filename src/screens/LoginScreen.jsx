// src/screens/LoginScreen.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../FireBase/FireBaseConfig";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch (error) {
      let message = error.message;
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        message =
          "Invalid email or password. Please try again or register a new account.";
      } else if (error.code === "auth/user-not-found") {
        message = "No account found with this email. Please register first.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many login attempts. Please wait and try again later.";
      }
      Alert.alert("Login Failed", message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/attendance_logo.png")}
        style={styles.logo}
      />

      <Text style={styles.title}>Attendance Tracker</Text>
      <Text style={styles.subtitle}>Attendance Monitoring System</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "SIGNING IN..." : "SIGN IN"}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 32,
    justifyContent: "center",
  },
  logo: { width: 126, height: 126, alignSelf: "center", marginBottom: 16 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#CC0000",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#1A3A8F",
    textAlign: "center",
    marginBottom: 40,
  },
  label: {
    fontSize: 13,
    color: "#CC0000",
    fontWeight: "bold",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  link: { color: "#1A3A8F", fontWeight: "bold" },
});
