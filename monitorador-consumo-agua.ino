#include <Wire.h>
#include <RTClib.h>
#include <WiFi.h>
#include <FirebaseESP32.h>

// --- Configurações Wi-Fi e Firebase ---
#define WIFI_SSID "Seu_SSID"
#define WIFI_PASSWORD "Sua_Senha"
#define FIREBASE_HOST "seu-projeto.firebaseio.com"
#define FIREBASE_AUTH "seu-token-do-firebase"

// --- Configurações do Sensor de Fluxo ---
#define SENSOR_PIN 4
#define PULSES_PER_LITER 5
#define DEBOUNCE_DELAY 50

// --- Variáveis de Contagem ---
int pulseCount = 0;
float totalLitros = 0.0;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long lastPrint = 0;
int ciclosComConsumo = 0;

// --- Objetos ---
WiFiClientSecure client;
FirebaseData firebaseData;
RTC_DS1307 rtc; // Objeto do módulo RTC

void setup() {
  Serial.begin(115200);
  Wire.begin(); // Inicializa comunicação I2C

  // --- Inicializa RTC ---
  if (!rtc.begin()) {
    Serial.println("Erro: RTC não encontrado!");
    while (1);
  }
  if (!rtc.isrunning()) {
    Serial.println("RTC estava parado, ajustando para hora atual...");
    rtc.adjust(DateTime(__DATE__, __TIME__)); // Ajusta para a hora da compilação
  }

  // --- Inicializa Wi-Fi ---
  Serial.print("Conectando ao Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConectado!");

  // --- Inicializa Firebase ---
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Firebase.reconnectWiFi(true);

  // --- Inicializa Sensor ---
  pinMode(SENSOR_PIN, INPUT_PULLUP);
}

void loop() {
  bool buttonState = digitalRead(SENSOR_PIN);

  // --- Debounce do Sensor (Botão) ---
  if (buttonState == LOW && lastButtonState == HIGH) {
    if (millis() - lastDebounceTime > DEBOUNCE_DELAY) {
      pulseCount++;
      lastDebounceTime = millis();
    }
  }
  lastButtonState = buttonState;

  // --- A cada 1 segundo calcula e envia dados ---
  if (millis() - lastPrint >= 1000) {
    float litros = pulseCount / (float)PULSES_PER_LITER;
    totalLitros += litros;
    DateTime now = rtc.now(); // Pega o horário atual

    // --- Exibe no Serial Monitor ---
    Serial.print(now.timestamp(DateTime::TIMESTAMP_FULL));
    Serial.print(" | Pulsos: ");
    Serial.print(pulseCount);
    Serial.print(" | Litros: ");
    Serial.print(litros, 3);
    Serial.print(" | Total: ");
    Serial.println(totalLitros, 3);

    // --- Detecta Vazamento ---
    if (pulseCount > 0) {
      ciclosComConsumo++;
    } else {
      ciclosComConsumo = 0;
    }

    if (ciclosComConsumo >= 5) {
      Serial.println("⚠️ Vazamento detectado!");
      Firebase.setString(firebaseData, "/alerta/vazamento", "Detectado em " + String(now.timestamp(DateTime::TIMESTAMP_TIME)));
    }

    // --- Envia Dados ao Firebase ---
    Firebase.setFloat(firebaseData, "/dados/volume", totalLitros);
    Firebase.setInt(firebaseData, "/dados/pulsos", pulseCount);
    Firebase.setString(firebaseData, "/dados/horario", now.timestamp(DateTime::TIMESTAMP_FULL));

    // --- Reseta Pulso ---
    pulseCount = 0;
    lastPrint = millis();
  }

  delay(50);
}