// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title UTPay
 * @dev Contrato para la gestión de pagos universitarios vinculados a la identidad del estudiante.
 * Implementa un modelo de "Abstracción de Identidad" donde el saldo reside en el ID (correo)
 * y no en la dirección de la billetera directamente.
 */
contract UTPay {
    address public admin;
    string public name = "UTPay University Token";
    string public symbol = "UTP";
    uint8 public decimals = 18;

    struct Student {
        string email;
        address wallet;
        uint256 balance;
        bool isRegistered;
    }

    // Mapping de Correo -> Información del Estudiante
    mapping(string => Student) public students;
    // Mapping de Billetera -> Correo (para saber quién firma)
    mapping(address => string) public walletToEmail;

    event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata);
    event WalletUpdated(string email, address oldWallet, address newWallet);
    event StudentRegistered(string email, address wallet);
    event Mint(string email, uint256 amount);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Solo la Universidad puede ejecutar esto");
        _;
    }

    /**
     * @dev Registra un nuevo estudiante en el sistema.
     */
    function registerStudent(string memory _email, address _wallet) public onlyAdmin {
        require(!students[_email].isRegistered, "Estudiante ya registrado");
        require(bytes(walletToEmail[_wallet]).length == 0, "Billetera ya vinculada a otro correo");

        students[_email] = Student(_email, _wallet, 0, true);
        walletToEmail[_wallet] = _email;

        emit StudentRegistered(_email, _wallet);
    }

    /**
     * @dev Permite a la administración actualizar la billetera de un estudiante (Recuperación).
     */
    function updateWallet(string memory _email, address _newWallet) public onlyAdmin {
        require(students[_email].isRegistered, "Estudiante no existe");
        require(bytes(walletToEmail[_newWallet]).length == 0, "Nueva billetera ya esta en uso");

        address oldWallet = students[_email].wallet;
        
        // Limpiar vínculo anterior
        delete walletToEmail[oldWallet];
        
        // Actualizar a nueva billetera
        students[_email].wallet = _newWallet;
        walletToEmail[_newWallet] = _email;

        emit WalletUpdated(_email, oldWallet, _newWallet);
    }

    /**
     * @dev Carga saldo a un estudiante (ej: becas, depósitos en caja).
     */
    function mint(string memory _email, uint256 _amount) public onlyAdmin {
        require(students[_email].isRegistered, "Estudiante no existe");
        students[_email].balance += _amount;
        
        emit Mint(_email, _amount);
    }

    /**
     * @dev Transfiere UTP entre estudiantes usando sus correos.
     */
    function transferByEmail(string memory _toEmail, uint256 _amount, string memory _metadata) public {
        string memory fromEmail = walletToEmail[msg.sender];
        require(bytes(fromEmail).length > 0, "Emisor no registrado en el sistema");
        require(students[_toEmail].isRegistered, "Receptor no registrado");
        require(students[fromEmail].balance >= _amount, "Saldo insuficiente");

        students[fromEmail].balance -= _amount;
        students[_toEmail].balance += _amount;

        emit Transfer(fromEmail, _toEmail, _amount, _metadata);
    }

    /**
     * @dev Consulta el saldo de un estudiante por su correo.
     */
    function getBalance(string memory _email) public view returns (uint256) {
        return students[_email].balance;
    }

    /**
     * @dev Obtiene el correo vinculado a una billetera.
     */
    function getEmailByWallet(address _wallet) public view returns (string memory) {
        return walletToEmail[_wallet];
    }
}
