const express = require('express');

module.exports = function ({logger, menuService}) {

    const router = express.Router();

    router.get('/menu', async (request, response) => {
        logger.info('GET menu');
        const data = await menuService.getMenuElement();
        response.render('index', {data})
    });
    return router;
};
