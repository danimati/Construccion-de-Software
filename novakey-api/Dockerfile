# Requiere compilar antes: ./mvnw package -DskipTests
FROM eclipse-temurin:17-jre-alpine
RUN adduser -D novakey
USER novakey
COPY target/novakey-api-*.jar /app/novakey-api.jar
ENTRYPOINT ["java", "-jar", "/app/novakey-api.jar"]
