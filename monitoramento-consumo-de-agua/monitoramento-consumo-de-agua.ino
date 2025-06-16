#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"

#define WIFI_SSID ""
#define WIFI_PASSWORD ""

#define DATABASE_URL "https://blueflow-7e0d7-default-rtdb.firebaseio.com"

#define PINO_SENSOR 18
const float fator_calibracao = 7.5;
volatile int pulsos = 0;
float vazao_Lmin = 0.0;

unsigned long tempoUltimaLeitura = 0;
const unsigned long intervaloLeitura = 1000;

void IRAM_ATTR contaPulso() {
  pulsos++;
}

void conectarWiFi() {
  Serial.print("Conectando ao Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    vTaskDelay(500 / portTICK_PERIOD_MS);
  }
  Serial.println("\n✅ Wi-Fi conectado!");
}

void enviarFirebase(float vazao, String timestamp) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Wi-Fi desconectado!");
    return;
  }

  HTTPClient http;
  String url;
  String json = String(vazao, 2);

  url = String(DATABASE_URL) + "/leituras/vazao_Lmin.json";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int httpResponseCode = http.PUT(json);

  if (httpResponseCode > 0) {
    Serial.println("✅ Valor atual enviado!");
  } else {
    Serial.printf("❌ Erro atual: %s\n", http.errorToString(httpResponseCode).c_str());
    http.end();
    return;
  }
  http.end();

  url = String(DATABASE_URL) + "/leituras_com_tempo/" + timestamp + ".json";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  httpResponseCode = http.PUT(json);

  if (httpResponseCode > 0) {
    Serial.println("✅ Histórico enviado!");
  } else {
    Serial.printf("❌ Erro histórico: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  http.end();
}

void sincronizarHorario() {
  configTime(-10800, 0, "pool.ntp.org");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    vTaskDelay(500 / portTICK_PERIOD_MS);
  }
  Serial.println("\n🕒 Horário sincronizado!");
}

String gerarTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "erro_timestamp";
  }
  char buffer[20];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d_%H-%M-%S", &timeinfo);
  return String(buffer);
}

void setup() {
  Serial.begin(115200);
  vTaskDelay(300 / portTICK_PERIOD_MS);

  pinMode(PINO_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contaPulso, FALLING);

  conectarWiFi();
  sincronizarHorario();
}

void loop() {
  if (millis() - tempoUltimaLeitura >= intervaloLeitura) {
    tempoUltimaLeitura = millis();

    int pulsosPorSegundo = pulsos;
    pulsos = 0;
    vazao_Lmin = (float)pulsosPorSegundo / fator_calibracao;
    Serial.printf("Vazão: %.2f L/min\n", vazao_Lmin);

    String timestamp = gerarTimestamp();
    enviarFirebase(vazao_Lmin, timestamp);
  }
  vTaskDelay(10 / portTICK_PERIOD_MS);
}

