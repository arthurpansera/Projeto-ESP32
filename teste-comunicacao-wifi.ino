#include <WiFi.h>
#include <FirebaseESP32.h>

// Credenciais Wi-Fi
const char* ssid = "Visitantes";
const char* password = "";

// Configurações do Firebase
#define FIREBASE_HOST "monitorado-consumo-agua.firebaseio.com"
#define FIREBASE_AUTH ""

// Inicializa o Firebase
FirebaseData firebaseData;

void setup() {
  Serial.begin(115200);

  // Conecta ao Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Conectando ao Wi-Fi...");
  }
  Serial.println("Conectado ao Wi-Fi!");

  // Inicializa o Firebase
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
}

void loop() {
  // Envia dados simulados para o Firebase
  float consumoAgua = 10.5;

  if (Firebase.setFloat(firebaseData, "/consumoAgua", consumoAgua)) {
    Serial.println("Dados enviados para o Firebase!");
  } else {
    Serial.println("Falha ao enviar dados para o Firebase.");
    Serial.println(firebaseData.errorReason());
  }

  delay(5000);
}