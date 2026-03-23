class Util {
  static validate_prams(InputArr, KeyArr, NameArr) {
    const errors = {};
    for (const key in KeyArr) {
      try {
        if (InputArr[key] !== undefined && typeof InputArr[key] === "string") {
          InputArr[key] = InputArr[key].trim();
        }
        if (
          InputArr[key] === undefined ||
          InputArr[key] === null ||
          InputArr[key] === ""
        ) {
          errors[key] = `${NameArr[key] || key} is missing.`;
        } else if (!this.regValidate(KeyArr[key], InputArr[key])) {
          errors[key] = `${NameArr[key] || key} is in the wrong format.`;
        }
      } catch (err) {
        errors[key] = err.message;
      }
    }
    return errors;
  }

  static regValidate(type, val) {
    switch (type) {
      case "N":
        return /^(-)?\d+$/.test(val);
      case "EMAIL":
        return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,8})?$/.test(val);
      case "ANY":
        return true;
      default:
        return false;
    }
  }

  static getErrorResponse(error, message = null) {
    if (typeof error === "object") {
      return {
        success: false,
        code: 422,
        message: message,
        error: error,
      };
    }
    return {
      success: false,
      code: 500,
      message: message,
      error: error,
    };
  }

  static getSuccessResponse(data, message = null) {
    return {
      success: true,
      code: 200,
      message: message,
      data: data,
    };
  }
}

module.exports = Util;
