Feature: Registro de usuarios en Belissa Joyas

  Scenario: Registro exitoso con datos válidos
    Given que tengo los datos de un usuario nuevo
    When envío la solicitud de registro
    Then debo recibir un token de acceso
    And el usuario debe tener rol cliente

  Scenario: Registro fallido por email duplicado
    Given que ya existe un usuario registrado con ese email
    When envío la solicitud de registro con el mismo email
    Then debo recibir un error 409

  Scenario: Registro fallido por contraseña corta
    Given que tengo los datos con contraseña menor a 6 caracteres
    When envío la solicitud de registro
    Then debo recibir un error 400
