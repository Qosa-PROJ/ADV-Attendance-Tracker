import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../FireBase/FireBaseConfig";
import useWebAlert from "../components/WebAlertModal";

export default function LoginScreen({ navigation }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email || !password) {
      showAlert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      let msg = err.message;
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        msg =
          "Invalid email or password. Please try again or register a new account.";
      } else if (err.code === "auth/user-not-found") {
        msg = "No account found with this email. Please register first.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many login attempts. Please wait and try again.";
      }
      showAlert("Login Failed", msg);
    }
    setLoading(false);
  };

  return (
    <View style={s.container}>
      <Image
        source={require("../../assets/attendance_logo.png")}
        style={s.logo}
      />
      <Text style={s.title}>Attendance Tracker</Text>
      <Text style={s.subtitle}>Attendance Monitoring System</Text>

      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={s.label}>Password</Text>
      <View style={s.passRow}>
        <TextInput
          style={s.passInput}
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
        />
        <TouchableOpacity
          style={s.passToggle}
          onPress={() => setShowPass(!showPass)}
        >
          <Image
            source={
              showPass
                ? require("../../assets/hide-password.png")
                : require("../../assets/view-password.png")
            }
            style={s.passIcon}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.button} onPress={login} disabled={loading}>
        <Text style={s.buttonText}>
          {loading ? "SIGNING IN..." : "SIGN IN"}
        </Text>
      </TouchableOpacity>

      <View style={s.footer}>
        <Text>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={s.link}>Register</Text>
        </TouchableOpacity>
      </View>

      {AlertModal}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
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
  passRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 16,
    paddingRight: 8,
  },
  passInput: { flex: 1, padding: 14, fontSize: 14 },
  passToggle: { padding: 8 },
  passIcon: { width: 20, height: 20 },
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
