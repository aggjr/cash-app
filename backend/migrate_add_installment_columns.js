const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Fallback if .env is in root
if (!process.env.DB_USER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}
const db = require('./config/database');

async function runMigration() {
    let connection;
    try {
        console.log('Starting migration: add installment columns to entradas...');
        connection = await db.getConnection();

        // Add installment_group_id
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_group_id VARCHAR(50) DEFAULT NULL AFTER forma_pagamento
            `);
            console.log('Added installment_group_id column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column installment_group_id already exists');
            } else {
                throw e;
            }
        }

        // Add installment_number
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_number INT DEFAULT NULL AFTER installment_group_id
            `);
            console.log('Added installment_number column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column installment_number already exists');
            } else {
                throw e;
            }
        }

        // Add installment_total
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_total INT DEFAULT NULL AFTER installment_number
            `);
            console.log('Added installment_total column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column installment_total already exists');
            } else {
                throw e;
            }
        }

        // Add installment_interval
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_interval VARCHAR(20) DEFAULT NULL AFTER installment_total
            `);
            console.log('Added installment_interval column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column installment_interval already exists');
            } else {
                throw e;
            }
        }

        // Add installment_custom_days
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_custom_days INT DEFAULT NULL AFTER installment_interval
            `);
            console.log('Added installment_custom_days column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column installment_custom_days already exists');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully');
        // process.exit(0); // Removed for module usage
    } catch (error) {
        console.error('Migration failed:', error);
        // process.exit(1); // Don't crash server, just log. Or verify if we should throw?
        // Better to rethrow so server startup chain catches it if critical
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = runMigration;
